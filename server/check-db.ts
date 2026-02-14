import { prisma } from './configs/prisma.ts';

async function main() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, name: true, generatedImage: true, isGenerating: true, error: true, createdAt: true }
  });
  console.log(JSON.stringify(projects, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
