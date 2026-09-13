import {isValidIndianMobile,normalizeMobile} from "@/src/lib/auth/mobile";

export const registrationFieldMessages={
  name:"Full name is required and must contain at least 2 characters.",
  mobile:"Please enter a valid 10-digit mobile number.",
  email:"Invalid email format.",
  accountType:"Please select an account type.",
  password:"Password must contain at least 8 characters, including uppercase, lowercase, a number and a special character.",
  termsAccepted:"Please accept the Terms & Conditions.",
  yearsExperience:"Years of experience must be between 0 and 80.",
} as const;

export type RegistrationField=keyof typeof registrationFieldMessages;
const accountTypes=new Set(["buyer","owner","agent","pg_owner"]);
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const disposableDomains=new Set(["tempmail.com","guerrillamail.com","10minutemail.com","mailinator.com"]);
export function isAllowedRegistrationEmail(value:string){const email=value.trim().toLowerCase();return emailPattern.test(email)&&!disposableDomains.has(email.split("@")[1]||"")}
const strongPassword=/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}/;

export function validateRegistrationFields(input:Record<string,FormDataEntryValue|undefined>){
  const errors:Partial<Record<RegistrationField,string>>={};
  const value=(key:string)=>typeof input[key]==="string"?input[key].trim():"";
  if(value("name").length<2)errors.name=registrationFieldMessages.name;
  if(!isValidIndianMobile(normalizeMobile(value("mobile"))))errors.mobile=registrationFieldMessages.mobile;
  if(!isAllowedRegistrationEmail(value("email")))errors.email="Use a permanent email address; disposable email domains are not accepted.";
  if(!accountTypes.has(value("accountType")))errors.accountType=registrationFieldMessages.accountType;
  if(!strongPassword.test(value("password")))errors.password=registrationFieldMessages.password;
  if(value("termsAccepted")!=="accepted")errors.termsAccepted=registrationFieldMessages.termsAccepted;
  const years=value("yearsExperience");if(years&&(Number.isNaN(Number(years))||Number(years)<0||Number(years)>80))errors.yearsExperience=registrationFieldMessages.yearsExperience;
  return errors;
}

export function registrationFieldsFromIssues(paths:string[]){
  return [...new Set(paths.filter((path):path is RegistrationField=>path in registrationFieldMessages))];
}

export function registrationErrorCode(error:{code?:string;message?:string;status?:number}){
  const code=(error.code||"").toLowerCase(),message=(error.message||"").toLowerCase();
  if(code.includes("over_email_send_rate_limit")||code.includes("over_request_rate_limit")||error.status===429)return"rate_limited";
  if(code.includes("user_already_exists")||code.includes("email_exists")||message.includes("already registered")||message.includes("already exists"))return"account_exists";
  if(code.includes("email_address_invalid")||code.includes("validation_failed")&&message.includes("email")||message.includes("invalid email"))return"invalid_email";
  if(code.includes("weak_password")||message.includes("password")&&(message.includes("weak")||message.includes("strength")))return"password_weak";
  if(message.includes("profiles_mobile_unique_idx")||message.includes("duplicate key")&&message.includes("mobile"))return"mobile_unavailable";
  return"registration_failed";
}
