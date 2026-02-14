 import express from 'express'
import { protect } from '../middlewares/auth.ts'
import { createProject, createVideo, deleteProject, getAllPublishedProjects } from '../controllers/projectController.ts'
import upload from '../configs/multer.ts'

 const projectRouter=express.Router()

 projectRouter.post('/create',upload.array('images',2),protect,createProject)
 projectRouter.post('/video',protect,createVideo)
 projectRouter.get('/published',getAllPublishedProjects)
 projectRouter.delete('/:projectId',protect,deleteProject)

 export default projectRouter