import { Request, Response } from "express"
import * as Sentry from "@sentry/node"
import { prisma } from "../configs/prisma.ts";
import { v2 as cloudinary } from 'cloudinary'
// import { GenerateContentConfig,HarmBlockThreshold,HarmCategory } from "@google/genai";
import fs from 'fs';
import path  from "path";
// import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();
import { resolve } from "dns";





const loadImage = (path:string,mimeType:string)=>{
   return{
      inlineData:{
         data:fs.readFileSync(path).toString('base64'),
         mimeType
      }
   }
}



export const createProject = async (req: Request, res: Response) => {
   // const ai = new GoogleGenAI({
   //     apiKey: process.env.GEMINI_API_KEY!,
   //   });

   console.log('[createProject] ▶ Endpoint hit');
   let tempProjectId: string;
   const { userId } = req.auth();
   console.log('[createProject] userId:', userId);
   let isCreditDeducted = false;

   const { name = "New Project", aspectRatio, userPrompt, productName, productDescription, targetLength = 5 } = req.body;
   console.log('[createProject] Request body:', { name, aspectRatio, userPrompt, productName, productDescription, targetLength });

   const images: any = req.files;
   console.log('[createProject] Images received:', images?.length || 0);

   if (images.length < 2 || !productName) {
      console.log('[createProject] ✗ Validation failed: need at least 2 images and productName');
      return res.status(400).json({ message: 'please upload at least 2 images' })
   }

   const user = await prisma.user.findUnique({ where: { id: userId } })
   console.log('[createProject] User credits:', user?.credits);
   if (!user || user.credits < 5) {
      console.log('[createProject] ✗ Insufficient credits');
      return res.status(401).json({ message: 'Insufficient credits' })
   }
   else {
      //deduct credits for image generation
      await prisma.user.update({
         where: { id: userId },
         data: { credits: { decrement: 5 } }
      }).then(() => { isCreditDeducted = true })
      console.log('[createProject] ✓ Credits deducted (5)');
   }

   try {
      let uploadedImages = await Promise.all(
         images.map(async (item: any) => {
            let result = await cloudinary.uploader.upload(item.path, { resource_type: 'image' });
            return result.secure_url
         })
      )
      console.log('[createProject] ✓ Images uploaded to Cloudinary:', uploadedImages);

      // --- OpenRouter image generation (combining person + product images) ---
      const openrouterApiKey = process.env.OPENROUTER_API_KEY;
      if (!openrouterApiKey) {
        console.log('[createProject] ✗ OpenRouter API key not set');
        throw new Error('OpenRouter API key not set');
      }
      console.log('[createProject] ✓ OpenRouter API key found');

      const promptText = `combine the person and product into a realistic photo. make the person naturally hold or use the product. match lighting, shadows, scale and perspective. make the person stand in professional studio lighting. output ecommerce-quality photo realistic imagery. ${userPrompt}`;

      console.log('[createProject] Sending request to OpenRouter with image URLs...');
      // Call OpenRouter chat completions API with image generation model
      // Using OpenAI GPT-5 Image Mini via OpenRouter (non-Google model)
      const openrouterResponse = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'openai/gpt-5-image-mini',
          modalities: ['image', 'text'],
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: promptText,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: uploadedImages[0],
                  },
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: uploadedImages[1],
                  },
                },
              ],
            },
          ],
          max_tokens: 4096,
          image_config: {
            aspect_ratio: aspectRatio === '1:1' ? '1:1' : aspectRatio === '16:9' ? '16:9' : '9:16',
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${openrouterApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000, // 2 minute timeout for image generation
        }
      );

      // Extract generated image from response
      console.log('[createProject] ✓ OpenRouter response received, status:', openrouterResponse.status);
      const responseData = openrouterResponse.data;
      console.log('[createProject] Response keys:', Object.keys(responseData));
      console.log('[createProject] Full response:', JSON.stringify(responseData).substring(0, 500));
      let generatedImageUrl: string;

      // Handle OpenRouter image generation response format
      // Images are returned in choices[0].message.images as base64 data URLs
      if (responseData?.choices?.[0]?.message?.images?.[0]?.image_url?.url) {
        generatedImageUrl = responseData.choices[0].message.images[0].image_url.url;
      } else if (responseData?.data?.[0]?.url) {
        generatedImageUrl = responseData.data[0].url;
      } else if (responseData?.data?.[0]?.b64_json) {
        generatedImageUrl = `data:image/png;base64,${responseData.data[0].b64_json}`;
      } else {
        console.error('[createProject] ✗ Unexpected response structure:', JSON.stringify(responseData));
        throw new Error('No image generated from OpenRouter');
      }

      console.log('[createProject] ✓ Generated image URL obtained');
      console.log('[createProject] Image URL length:', generatedImageUrl.length, 'chars');

      // Save base64 image to a temp file before uploading to Cloudinary (avoids timeout with large data URLs)
      let tempImagePath: string | null = null;
      let cloudinaryInput: string = generatedImageUrl;
      if (generatedImageUrl.startsWith('data:')) {
        const matches = generatedImageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1];
          const base64Data = matches[2];
          tempImagePath = path.join('temp', `gen-${userId}-${Date.now()}.${ext}`);
          fs.mkdirSync('temp', { recursive: true });
          fs.writeFileSync(tempImagePath, Buffer.from(base64Data, 'base64'));
          cloudinaryInput = tempImagePath;
          console.log('[createProject] ✓ Saved base64 image to temp file:', tempImagePath);
        }
      }

      const project = await prisma.project.create({
         data: {
            name,
            userId,
            productName,
            productDescription,
            userPrompt,
            aspectRatio,
            targetLength: parseInt(targetLength),
            uploadedImages,
            isGenerating: true
         }
      })
      tempProjectId = project.id;
      console.log('[createProject] ✓ Project created in DB, id:', project.id);

      // Upload to Cloudinary from temp file (or URL if not base64)
      console.log('[createProject] Uploading generated image to Cloudinary...');
      const uploadResult = await cloudinary.uploader.upload(cloudinaryInput, {
        resource_type: 'image',
        timeout: 120000,
      });
      console.log('[createProject] ✓ Generated image uploaded to Cloudinary:', uploadResult.secure_url);

      // Clean up temp file
      if (tempImagePath && fs.existsSync(tempImagePath)) {
        fs.unlinkSync(tempImagePath);
        console.log('[createProject] ✓ Temp file cleaned up');
      }
      await prisma.project.update({
        where: { id: project.id },
        data: {
          generatedImage: uploadResult.secure_url,
          isGenerating: false
        }
      });

      console.log('[createProject] ✓ Project updated, sending response');
      res.json({ projectId: project.id });

      // --- GoogleGenAI code commented out ---
      /*
      const model = "gemini-2.5-flash-image";
      const generationConfig: GenerateContentConfig = { ... };
      //image to base64 structure for ai model
      const img1base64 =loadImage(images[0].path,images[0].mimetype);
      const img2base64 =loadImage(images[1].path,images[1].mimetype);
      const prompt={ text: ... };
      const response:any=await ai.models.generateContent({ ... });
      // ...existing GoogleGenAI code...
      */


   } catch (error: any) {
      console.error('[createProject] ✗ Error:', error.message);
      console.error('[createProject] ✗ Full error:', error?.response?.data || error);
      if(tempProjectId!){
         //update project status and error message
         await prisma.project.update({
            where:{id:tempProjectId},
            data:{isGenerating:false,error:error.message}
         })
      }
     if(isCreditDeducted){
      console.log('[createProject] Refunding 5 credits to user');
      //add credits back
      await prisma.user.update({
         where:{id:userId},
         data:{credits:{increment:5}}
      })
     }

      Sentry.captureException(error);
      res.status(500).json({ message: error.message });
   }
}

export const createVideo = async (req: Request, res: Response) => {

//    const ai = new GoogleGenAI({
//     apiKey: process.env.GEMINI_API_KEY!,
//   });

   console.log('[createVideo] ▶ Endpoint hit');
   const {userId}=req.auth()
   const {projectId}=req.body;
   console.log('[createVideo] userId:', userId, 'projectId:', projectId);
   let isCreditDeducted=false;

   const user=await prisma.user.findUnique({
      where:{id:userId}
   })
   console.log('[createVideo] User credits:', user?.credits);
    if(!user || user.credits<10){
      console.log('[createVideo] ✗ Insufficient credits');
      return res.status(401).json({message:'insufficient credits'});
    }

    //dedut credits for video generation
    await prisma.user.update({
      where:{id:userId},
      data:{credits:{decrement:10}}
    }).then(()=>{isCreditDeducted=true});

   try {
     const project=await prisma.project.findUnique({
      where:{id:projectId,userId},
      include:{user:true}
     })
     console.log('[createVideo] Project found:', !!project, 'isGenerating:', project?.isGenerating);

     if(!project || project.isGenerating){
      console.log('[createVideo] ✗ Project not found or generation in progress');
      return res.status(404).json({message:'Generation in progress'});
     }

     if(project.generatedVideo){
      console.log('[createVideo] ✗ Video already generated');
      return res.status(404).json({message:'video alredy generated'});
     }

     await prisma.project.update({
      where:{id:projectId},
      data:{isGenerating:true}
     })

     const prompt = `make the person showcase the product which is ${project.productName}
     ${project.productDescription && `and product Description:${project.productDescription}`}`
    
     const model='veo-3.1-generate-preview'
     if(!project.generatedImage){
      throw new Error('Generated image is not found')
     }

     const image=await axios.get(project.generatedImage,{responseType:'arraybuffer',})
     const imageBytes:any=Buffer.from(image.data)

     // Define filename and filePath before using them
     const filename = `${userId}-${Date.now()}.mp4`;
     const filePath = path.join('videos', filename);

     // Video generation with Gemini is currently disabled/commented out.
     // let operation:any=await ai.models.generateVideos({ ... })
     // while(!operation.done){ ... }
     // await ai.files.download({ ... })
     // If you want to enable Gemini video generation, uncomment and configure the above lines.

     // Create a dummy video file at filePath
     fs.mkdirSync('videos', { recursive: true });
     fs.writeFileSync(filePath, Buffer.from([])); // Creates an empty file

     console.log('[createVideo] Uploading video to Cloudinary...');
     const uploadResult = await cloudinary.uploader.upload(filePath,{
      resource_type:'video'
     });
     console.log('[createVideo] ✓ Video uploaded:', uploadResult.secure_url);

     await prisma.project.update({
      where:{id:projectId},
      data:{
         generatedVideo:uploadResult.secure_url,
         isGenerating:false
      }
     })
     //remove video file from disk after upload
     fs.unlinkSync(filePath);

     console.log('[createVideo] ✓ Video generation completed');
     res.json({message:'video generation completed',videoUrl:uploadResult.secure_url})


   } catch (error: any) {
      console.error('[createVideo] ✗ Error:', error.message);
      console.error('[createVideo] ✗ Full error:', error?.response?.data || error);

         //update project status and error message
         await prisma.project.update({
            where:{id:projectId,userId},
            data:{isGenerating:false,error:error.message}
         })
      
     if(isCreditDeducted){
      console.log('[createVideo] Refunding 10 credits to user');
      //add credits back
      await prisma.user.update({
         where:{id:userId},
         data:{credits:{increment:10}}
      })
     }

      Sentry.captureException(error);
      res.status(500).json({ message: error.message });
   }
}

export const getAllPublishedProjects = async (req: Request, res: Response) => {
   console.log('[getAllPublishedProjects] ▶ Endpoint hit');
   try {
       const projects=await prisma.project.findMany({
         where:{isPublished:true}
       })
       console.log('[getAllPublishedProjects] ✓ Found', projects.length, 'published projects');
       res.json({projects})


   } catch (error: any) {
      Sentry.captureException(error);
      res.status(500).json({ message: error.message });
   }
}

export const deleteProject = async (req: Request, res: Response) => {
   console.log('[deleteProject] ▶ Endpoint hit');
   try {
        const {userId}=req.auth();
        const{projectId}=req.params;
        console.log('[deleteProject] userId:', userId, 'projectId:', projectId);
    
        const project=await prisma.project.findUnique({
         where:{id:projectId,userId}
        })

        if(!project){
         console.log('[deleteProject] ✗ Project not found');
         return res.status(404).json({message:'Project not found '})
        }

        await prisma.project.delete({
         where:{id:projectId}
        })
        console.log('[deleteProject] ✓ Project deleted');
        res.json({message:'Project deleted'});

   } catch (error: any) {
      Sentry.captureException(error);
      res.status(500).json({ message: error.message });
   }
}
