import {z} from "zod";
import {isValidIndianMobile} from "@/src/lib/auth/mobile";

const words=(value:string)=>value.trim().split(/\s+/).filter(Boolean).length;
const indianDigits=(value:string)=>{const digits=value.replace(/\D/g,"");return digits.length===12&&digits.startsWith("91")?digits.slice(2):digits};

export const enquirySchema=z.object({
  propertyReference:z.string().trim().max(40).optional().default(""),
  name:z.string().trim().min(2,"Please enter your name.").max(100),
  mobile:z.string().trim().min(6,"Please enter a valid mobile number.").max(20),
  isForeign:z.enum(["true","false"]).optional().default("false"),
  countryCode:z.string().trim().max(5).optional().default(""),
  email:z.union([z.literal(""),z.email("Please enter a valid email address.")]).optional().default(""),
  enquiryType:z.enum(["Buy / Sell Property","Rent / Lease","Paying Guest","NRI Services","Advertising / Business Enquiry","General Enquiry"]).optional(),
  propertyRequirement:z.string().trim().max(200).optional().default(""),
  message:z.string().trim().min(5,"Please enter your message.").max(5000).refine(value=>words(value)<=250,"Please keep your message within 250 words."),
  website:z.string().max(200).optional().default(""),captchaToken:z.string().optional(),"cf-turnstile-response":z.string().optional(),
}).superRefine((value,context)=>{
  const digits=value.mobile.replace(/\D/g,"");
  if(value.isForeign==="true"){
    if(!/^\+[1-9][0-9]{0,3}$/.test(value.countryCode)||!/^[0-9]{6,14}$/.test(digits)||`${value.countryCode}${digits}`.replace(/\D/g,"").length>15)context.addIssue({code:"custom",path:["mobile"],message:"Please enter a valid international mobile number."});
  }else if(!isValidIndianMobile(indianDigits(value.mobile)))context.addIssue({code:"custom",path:["mobile"],message:"Please enter a valid 10-digit Indian mobile number."});
}).transform(value=>({...value,mobile:value.isForeign==="true"?`${value.countryCode}${value.mobile.replace(/\D/g,"")}`:indianDigits(value.mobile)}));
