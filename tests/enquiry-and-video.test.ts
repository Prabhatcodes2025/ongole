import assert from "node:assert/strict";
import test from "node:test";
import { enquirySchema } from "../src/lib/enquiries/validation";
import { youtubeVideoId } from "../src/lib/youtube";

test("validates and normalizes public enquiries",()=>{const parsed=enquirySchema.parse({name:"Ravi Kumar",mobile:"+91 98765 43210",email:"",message:"Please arrange a visit."});assert.equal(parsed.mobile,"9876543210");assert.equal(parsed.website,"");assert.equal(enquirySchema.safeParse({name:"A",mobile:"123",message:"x"}).success,false)});
test("accepts only supported YouTube URLs",()=>{assert.equal(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ"),"dQw4w9WgXcQ");assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),"dQw4w9WgXcQ");assert.equal(youtubeVideoId("https://example.com/dQw4w9WgXcQ"),null)});
