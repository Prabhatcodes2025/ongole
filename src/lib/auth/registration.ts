import {isValidIndianMobile,normalizeMobile} from "@/src/lib/auth/mobile";

export const registrationFieldMessages={
  name:"Full name is required and must contain at least 2 characters.",
  mobile:"Please enter a valid mobile number.",
  email:"Email address is invalid.",
  accountType:"Please select an account type.",
  password:"Password must contain at least 8 characters, including uppercase, lowercase, a number and a special character.",
  termsAccepted:"Please accept the Terms & Conditions.",
  yearsExperience:"Years of experience must be between 0 and 80.",
} as const;

export type RegistrationField=keyof typeof registrationFieldMessages;
const accountTypes=new Set(["buyer","owner","agent","pg_owner"]);
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strongPassword=/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}/;

export function validateRegistrationFields(input:Record<string,FormDataEntryValue|undefined>){
  const errors:Partial<Record<RegistrationField,string>>={};
  const value=(key:string)=>typeof input[key]==="string"?input[key].trim():"";
  if(value("name").length<2)errors.name=registrationFieldMessages.name;
  if(!isValidIndianMobile(normalizeMobile(value("mobile"))))errors.mobile=registrationFieldMessages.mobile;
  if(!emailPattern.test(value("email")))errors.email=registrationFieldMessages.email;
  if(!accountTypes.has(value("accountType")))errors.accountType=registrationFieldMessages.accountType;
  if(!strongPassword.test(value("password")))errors.password=registrationFieldMessages.password;
  if(value("termsAccepted")!=="accepted")errors.termsAccepted=registrationFieldMessages.termsAccepted;
  const years=value("yearsExperience");if(years&&(Number.isNaN(Number(years))||Number(years)<0||Number(years)>80))errors.yearsExperience=registrationFieldMessages.yearsExperience;
  return errors;
}

export function registrationFieldsFromIssues(paths:string[]){
  return [...new Set(paths.filter((path):path is RegistrationField=>path in registrationFieldMessages))];
}
