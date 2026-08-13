export const indianMobilePattern=/^[6-9][0-9]{9}$/;
const repeatedDigits=/^([0-9])\1{9}$/;
const repeatedPair=/^([0-9]{2})\1{4}$/;
const repeatedBlock=/^([0-9]{5})\1$/;

export function normalizeMobile(value:string){return value.trim()}

export function isValidIndianMobile(value:string){
  const mobile=normalizeMobile(value);
  return indianMobilePattern.test(mobile)&&!repeatedDigits.test(mobile)&&!repeatedPair.test(mobile)&&!repeatedBlock.test(mobile);
}
