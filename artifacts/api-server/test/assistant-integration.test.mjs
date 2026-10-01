import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";

test("assistant read-only owner snapshot reuses actual goals/forecast and full ledger; optional real provider API-handler smoke", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const compiled = await build({ stdin: { contents: `
export * from "./src/lib/assistant.ts";
export { ownerGoals } from "./src/lib/goals.ts";
export { forecastSnapshot } from "./src/lib/forecast.ts";
export { default as router } from "./src/routes/assistant.ts";
export * from "@workspace/db"; export {eq, and, gte, lt, sql} from "drizzle-orm";`,
    resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"] });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const {db,pool,users,financeTransactions,financeAccounts,eq,sql,executeAssistant,ownerGoals,forecastSnapshot,router} = module.exports;
  const now = new Date(), today = now.toISOString().slice(0,10), from = today.slice(0,8)+"01";
  const through = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0)).toISOString().slice(0,10);
  const plan={intent:"summary",category:"all",mode:"calculate",from:null,to:null,compareFrom:null,compareTo:null,reason:"none",qualifierStatus:"none"};
  try {
    const students=await db.select({id:users.id}).from(users).where(eq(users.role,"student")).limit(2);
    assert(students.length,"An existing student is required; this test never seeds application data");
    for(const {id:owner} of students) await db.transaction(async tx=>{
      const mode=await tx.execute(sql`show transaction_read_only`);
      assert.equal(mode.rows[0].transaction_read_only,"on");
      const before=(await tx.select().from(financeTransactions).where(eq(financeTransactions.userId,owner))).length;
      const accounts=await tx.select().from(financeAccounts).where(eq(financeAccounts.userId,owner));
      const rows=await tx.select().from(financeTransactions).where(eq(financeTransactions.userId,owner));
      const ordinary=new Set(accounts.filter(a=>a.type!=="goal_reserve").map(a=>a.id));
      for(const language of ["en","ar"]) {
        const response=await executeAssistant(tx,owner,{question:"Summarize my finances",language},plan,now);
        assert.equal(response.status,"answered");
        for(const currency of new Set(accounts.filter(a=>ordinary.has(a.id)).map(a=>a.currency))) {
          const eligible=rows.filter(r=>ordinary.has(r.accountId)&&r.currency===currency&&r.category!=="transfer"&&
            r.goalFundingSource!=="student_account"&&r.createdAt.toISOString().slice(0,10)>=from&&r.createdAt.toISOString().slice(0,10)<=today);
          for(const [direction,key] of [["debit","spending"],["credit","income"]]) {
            const expected=eligible.filter(r=>r.direction===direction).reduce((n,r)=>n+r.amountMinor,0n);
            assert.equal(response.facts.find(f=>f.key===`${currency}:${key}`).minor,String(expected));
          }
        }
        for(const category of ["food","cafeteria","books","bookstore","transportation"])
          assert.equal((await executeAssistant(tx,owner,{question:"spending",language},{...plan,intent:"spending",category},now)).status,"answered");
        const actualGoals=await ownerGoals(owner,tx);
        const saved=await executeAssistant(tx,owner,{question:"saved",language},{...plan,intent:"saved"},now);
        assert.deepEqual(saved.facts.map(f=>[f.currency,f.minor]),actualGoals.totals.map(t=>[t.currency,String(t.reserved.minor)]));
        const goal=await executeAssistant(tx,owner,{question:"goal monthly",language},{...plan,intent:"goal_monthly"},now);
        assert(["answered","clarify"].includes(goal.status));
        const expected=await forecastSnapshot(tx,owner,today,through);
        for(const intent of ["forecast","income","upcoming"]) {
          const result=await executeAssistant(tx,owner,{question:intent,language},{...plan,intent},now);
          assert.equal(result.status,"answered");
          if(intent==="forecast") for(const c of expected.currencies)
            assert.equal(result.facts.find(f=>f.key==="forecast"&&f.currency===c.currency).minor,String(c.projectedBalance.minor));
        }
      }
      assert.equal((await tx.select().from(financeTransactions).where(eq(financeTransactions.userId,owner))).length,before);
    },{isolationLevel:"repeatable read",accessMode:"read only"});
    if(process.env.ASSISTANT_REAL_SMOKE==="1") {
      const handler=router.stack.find(l=>l.route?.path==="/assistant/query").route.stack[0].handle;
      for(const [language,question] of [["en","How much did I spend on food this month?"],["ar","كم أنفقت على الطعام هذا الشهر؟"]]) {
        let body,status=200;
        const res={locals:{principal:{userId:students[0].id,roles:["student"]}},setHeader(){},
          status(code){status=code;return this},json(value){body=value;return this}};
        await handler({body:{question,language}},res);
        assert.equal(status,200,`Real provider ${language}: ${body?.error?.code??"unexpected response"}`);
        assert.equal(body.status,"answered");
        assert.equal(body.intent,"spending");
        assert.equal(body.language,language);
        assert(body.facts.every(f=>f.provenance==="ledger"));
        const expected=await db.transaction(tx=>executeAssistant(tx,students[0].id,{question,language},
          {...plan,intent:"spending",category:"food"},new Date()),{isolationLevel:"repeatable read",accessMode:"read only"});
        assert.deepEqual(body.facts,expected.facts);
      }
    }
  } finally { await pool.end(); }
});