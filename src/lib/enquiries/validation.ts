import { z } from "zod";

export const enquirySchema=z.object({propertyReference:z.string().trim().max(40).optional().default(""),name:z.string().trim().min(2).max(100),mobile:z.string().transform((value)=>value.replace(/\D/g,"").slice(-10)).pipe(z.string().regex(/^[6-9][0-9]{9}$/)),email:z.union([z.literal(""),z.email()]).optional().default(""),message:z.string().trim().min(5).max(2000),website:z.string().max(200).optional().default(""),captchaToken:z.string().optional(),"cf-turnstile-response":z.string().optional()});
