import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
const schema=z.object({name:z.string().trim().min(1).max(120),address:z.string().trim().min(1).max(250)});
// DEVELOPMENT ONLY: add authentication, authorization and audit logging before deployment.
export async function GET(){const items=await prisma.building.findMany({orderBy:{createdAt:'desc'}});return NextResponse.json(items);}
export async function POST(request:Request){let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'Neplatný JSON'},{status:400})}const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:'Neplatné údaje'},{status:400});const item=await prisma.building.create({data:parsed.data});return NextResponse.json(item,{status:201});}
