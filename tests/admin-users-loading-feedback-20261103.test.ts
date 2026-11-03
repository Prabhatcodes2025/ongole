import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("admin users list uses shared pending controls and a responsive route skeleton",async()=>{const[list,loading,css]=await Promise.all([read("../app/admin/users/page.tsx"),read("../app/admin/users/loading.tsx"),read("../app/globals.css")]);assert.match(list,/PendingSubmitButton/);assert.match(list,/PendingLink as Link/);assert.match(list,/FormPendingStatus/);assert.match(loading,/aria-busy="true"/);assert.match(loading,/pending-spinner/);assert.match(loading,/admin-users-table-skeleton/);assert.match(css,/admin-users-filter-skeleton/);assert.match(css,/prefers-reduced-motion:reduce/)});

test("user detail navigation and each management action expose focused pending feedback",async()=>{const[detail,loading]=await Promise.all([read("../app/admin/users/[id]/page.tsx"),read("../app/admin/users/[id]/loading.tsx")]);assert.match(detail,/PendingLink as Link/);assert.match(detail,/Updating account status…/);assert.match(detail,/Granting permission…/);assert.match(detail,/Assigning role…/);assert.match(detail,/Removing role…/);assert.match(detail,/form-message success/);assert.match(detail,/form-message error/);assert.match(loading,/Loading user details/)});

test("user mutations keep RBAC and JSON behavior while redirecting browser forms with feedback",async()=>{const route=await read("../app/api/admin/users/[id]/route.ts");for(const permission of["users.manage","roles.manage"])assert.match(route,new RegExp(permission.replace(".","\\.")));for(const rpc of["admin_set_user_status","grant_one_property_permission","assign_user_role","remove_user_role","record_audit_event"])assert.match(route,new RegExp(rpc));assert.match(route,/content-type/);assert.match(route,/application\/json/);assert.match(route,/searchParams\.set\(type,code\)/);assert.doesNotMatch(route,/setTimeout/)});
