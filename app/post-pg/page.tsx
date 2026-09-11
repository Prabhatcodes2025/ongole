import type {Metadata} from "next";
import {PublicPgPostingForm} from "@/src/components/pg-posting-workflow";

export const metadata:Metadata={title:"Post paying guest accommodation",robots:{index:false,follow:false}};
export default function PostPgPage(){return <main id="main"><section className="inner-hero editorial"><div className="shell"><p className="eyebrow">One free listing per registered user</p><h1>Tell us about your PG</h1><p>Complete the public form now. You will sign in or create an account before anything is saved.</p></div></section><section className="section shell"><PublicPgPostingForm/></section></main>}
