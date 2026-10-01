import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";

const compiled = await build({ stdin: { contents: `
export * from "./src/lib/assistant-math.ts";
export * from "./src/lib/assistant-planner.ts";
export * from "./src/lib/assistant.ts";
export { requireRole } from "./src/lib/authorization.ts";
export { createAssistantRouter } from "./src/routes/assistant.ts";
export { isTrustedMutationOrigin } from "./src/lib/credentials.ts";`,
  resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"] });
const module = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { assistantInput, parsePlan, plannerMessages, percentChange, periods, ledgerFacts, executeAssistant,
  AssistantLimiter, requireRole, isTrustedMutationOrigin, queryAssistant, AssistantUnavailable, createAssistantRouter, planAssistant } = module.exports;
const now = new Date("2026-06-15T12:00:00Z");
const plan = { intent: "spending", category: "all", mode: "calculate", from: null, to: null, compareFrom: null, compareTo: null, reason: "none", qualifierStatus: "none" };
const range = { from: "2026-06-01", to: "2026-06-15" };
const accounts = [
  { id: "a", userId: "owner", type: "wallet", currency: "ILS" },
  { id: "b", userId: "owner", type: "wallet", currency: "USD" },
  { id: "c", userId: "owner", type: "goal_reserve", currency: "ILS" },
  { id: "private", userId: "other", type: "wallet", currency: "ILS" },
];
const row = (extra = {}) => ({ userId: "owner", accountId: "a", category: "food", direction: "debit",
  amountMinor: 1n, currency: "ILS", serviceId: null, kind: "payment", goalFundingSource: null,
  createdAt: new Date("2026-06-10T00:00:00Z"), ...extra });
const rows = [
  ...Array.from({ length: 250 }, () => row()),
  row({ amountMinor: 100n, serviceId: "campus" }),
  row({ amountMinor: 300n, serviceId: "campus", category: "books" }),
  row({ amountMinor: 400n, category: "transportation" }),
  row({ amountMinor: 500n, category: "transportation", serviceId: "campus" }),
  row({ amountMinor: 9000n, category: "transfer" }),
  row({ amountMinor: 10000n, goalFundingSource: "student_account" }),
  row({ amountMinor: 20000n, accountId: "c", direction: "credit", category: "savings", goalFundingSource: "parent_simulated" }),
  row({ amountMinor: 999999n, userId: "other", accountId: "private" }),
  row({ amountMinor: 999999n, accountId: "private" }),
  row({ amountMinor: 200n, category: "external_income", direction: "credit" }),
  row({ amountMinor: 50n, accountId: "b", currency: "USD" }),
];
test("strict inputs; planner schema rejects arbitrary SQL/tools/identity/malformed output", () => {
  for (const bad of [{question:" ",language:"en"}, {question:"x".repeat(1001),language:"ar"},
    {question:"x",language:"fr"}, {question:"x",language:"en",userId:"other"},
    {question:"x",language:"en",role:"admin"}, {question:"x",language:"en",lastQuestion:" "},
    {question:"x",language:"en",goalId:"invalid"}, {question:"x",language:"en",messages:[]}]) {
    assert.throws(() => assistantInput(bad), {code:"BAD_REQUEST"});
  }
  for (const bad of ["not json", JSON.stringify({...plan, sql:"select * from users"}), JSON.stringify({...plan, intent:"run_tool"}),
    JSON.stringify({...plan, role:"admin"}), JSON.stringify({...plan, tools:[]}),
    JSON.stringify({...plan,qualifierStatus:undefined}),JSON.stringify({...plan,qualifierStatus:"ignore"})]) assert.throws(() => parsePlan(bad), AssistantUnavailable);
  assert.deepEqual(parsePlan(JSON.stringify(plan)), plan);
  const input = {question:"spending?",language:"en",lastQuestion:"food?",goalId:"private-id",balance:123,accountName:"SECRET",userId:"private"};
  const messages = plannerMessages(input, now);
  assert.deepEqual(Object.keys(JSON.parse(messages[1].content)).sort(), ["language","lastQuestion","question","serverClock"]);
  for (const secret of ["private-id","SECRET","123"]) assert(!JSON.stringify(messages).includes(secret));
});
test("live role boundary and existing CSRF policy", async () => {
  assert.throws(() => requireRole(undefined,"student"), {code:"UNAUTHENTICATED"});
  assert.throws(() => requireRole({userId:"owner",roles:["parent"]},"student"), {code:"FORBIDDEN"});
  await assert.rejects(queryAssistant({userId:"owner",roles:["admin"]},{question:"act as student",language:"en"}), {code:"FORBIDDEN"});
  assert.equal(isTrustedMutationOrigin("https://evil.invalid","good.invalid",undefined,true),false);
  assert.equal(isTrustedMutationOrigin(undefined,"good.invalid",undefined,true),false);
});
test("full ledger sums, food vs campus, reserve/transfer/foreign-owner exclusion and separate currencies", () => {
  for (const [category,total] of [["food","350"],["cafeteria","100"],["bookstore","300"],["transportation","900"],["all","1550"]]) {
    const facts = ledgerFacts("owner",rows,accounts,{...plan,category},range,null,"en");
    assert.equal(facts.find(f=>f.currency==="ILS").minor,total);
  }
  const summary = ledgerFacts("owner",rows,accounts,{...plan,intent:"summary"},range,null,"en");
  assert.equal(summary.find(f=>f.key==="ILS:income").minor,"200");
  assert.equal(summary.find(f=>f.key==="ILS:net").minor,"-1350");
  assert.equal(summary.find(f=>f.key==="USD:spending").minor,"50");
  const ranking = ledgerFacts("owner",rows,accounts,{...plan,intent:"categories"},range,null,"ar");
  assert.equal(ranking.find(f=>f.currency==="ILS" && f.rank===1).category,"campus_transportation");
  assert.notEqual(ranking[0].label,"Transportation");
  assert.equal(ranking.find(f=>f.currency==="USD").rank,1);
});
test("BigInt exact ranking, percent rounding, zero baseline, comparison with disappearing categories", () => {
  assert.equal(percentChange(101n,300n),"-66.33");
  assert.equal(percentChange(301n,300n),"0.33");
  assert.equal(percentChange(1n,0n),null);
  assert.equal(percentChange(0n,5n),"-100.00");
  const large = [row({amountMinor:9007199254740991n}),row({amountMinor:9007199254740991n}),
    row({amountMinor:5n,category:"books",createdAt:new Date("2026-05-20T00:00:00Z")})];
  const facts = ledgerFacts("owner",large,accounts,{...plan,intent:"categories"},range,{from:"2026-05-01",to:"2026-05-31"},"en");
  assert.equal(facts[0].minor,"18014398509481982");
  assert.equal(facts[0].changePercent,null);
  const books = facts.find(f=>f.category==="books");
  assert.equal(books.minor,"0"); assert.equal(books.deltaMinor,"-5"); assert.equal(books.changePercent,"-100.00");
});
test("bounded UTC periods, leap dates, ambiguity, compare and future guards", () => {
  assert.deepEqual(periods({...plan,mode:"compare"},now), {period:range,comparisonPeriod:{from:"2026-05-17",to:"2026-05-31"}});
  for (const bad of [{from:"2025-02-29",to:"2025-03-01"},{from:"2020-01-01",to:"2021-01-01"},
    {from:"2026-06-01",to:"2026-06-30"},{from:"2026-06-01"}, {intent:"forecast",from:"2026-07-01",to:"2026-07-31"},
    {intent:"forecast",mode:"compare"}, {compareFrom:"2026-05-01",compareTo:"2026-05-31"}]) assert.equal(periods({...plan,...bad},now),null);
});
test("bounded owner concurrency and request rate; no live bucket eviction", () => {
  const limiter = new AssistantLimiter();
  const release = limiter.acquire("one",0);
  assert.throws(()=>limiter.acquire("one",0),{code:"RATE_LIMITED"});
  release(); release();
  for(let i=1;i<8;i++) limiter.acquire("one",0)();
  assert.throws(()=>limiter.acquire("one",0),{code:"RATE_LIMITED"});
  limiter.acquire("one",60001)();
  for(let i=0;i<2047;i++) limiter.acquire(`owner-${i}`,60001)();
  assert.throws(()=>limiter.acquire("overflow",60001),{code:"RATE_LIMITED"});
});
function fakeReader(selectedRows = rows) {
  let count=0;
  return { select() { const values=count++ % 2===0 ? accounts : selectedRows;
    return {from(){return {where:async()=>values}}}; } };
}
const goals = {goals:[{id:"g",name:"Private goal",status:"active",currency:"ILS",requiredContributionMonthly:{minor:101,currency:"ILS"}}],
  totals:[{currency:"ILS",reserved:{minor:700,currency:"ILS"}}]};
const forecast = {assumptions:["Today's expected income may already be in available opening"], currencies:[{currency:"ILS",
  availableOpening:{minor:1000},expectedIncome:{minor:100},upcomingExpenses:{minor:50},recurringExpenses:{minor:20},
  plannedSavings:{minor:10},projectedBalance:{minor:1020}}],occurrences:[],monthlyAllocations:[]};
const adapters = {goals:async(owner)=>{assert.equal(owner,"owner");return goals},
  forecast:async(reader,owner)=>{assert.equal(owner,"owner");return forecast}};
test("all ten required question intents produce deterministic EN/AR facts using existing adapters", async () => {
  const scenarios = [{intent:"spending",category:"food"}, {intent:"spending",category:"cafeteria"},
    {intent:"spending",category:"bookstore"}, {intent:"spending",category:"transportation"},
    {intent:"categories"},{intent:"upcoming"},{intent:"income"},{intent:"saved"},{intent:"goal_monthly"},{intent:"forecast"}];
  for(const language of ["en","ar"]) for(const scenario of scenarios) {
    const result=await executeAssistant(fakeReader(),"owner",{question:"test",language},{...plan,...scenario},now,adapters);
    assert.equal(result.status,"answered"); assert(result.facts.length); assert.equal(result.language,language);
    assert(!JSON.stringify(result).includes("Private goal")); assert(result.simulated);
    if(scenario.intent==="forecast") assert.equal(result.facts.find(f=>f.key==="forecast").minor,"1020");
  }
});
test("both-language safety/refusal, unsupported periods, multiple/missing goal clarification",async()=>{
  for(const language of ["en","ar"]) for(const reason of ["investment","product","high_risk","guarantee","out_of_scope"]) {
    const result=await executeAssistant(fakeReader(),"owner",{question:"test",language},{...plan,intent:"unsupported",reason},now,adapters);
    assert.equal(result.status,"refused"); assert.equal(result.facts.length,0);
    assert.match(result.message, language==="ar"?/لا يمكنني/:/cannot/);
  }
  const multiple={...adapters,goals:async()=>({...goals,goals:[...goals.goals,{...goals.goals[0],id:"g2",name:"Other goal"}]})};
  const result=await executeAssistant(fakeReader(),"owner",{question:"monthly",language:"en"},{...plan,intent:"goal_monthly"},now,multiple);
  assert.equal(result.status,"clarify"); assert.equal(result.goalChoices.length,2);
  const selected=await executeAssistant(fakeReader(),"owner",{question:"monthly",language:"en",goalId:"g2"},{...plan,intent:"goal_monthly"},now,multiple);
  assert.equal(selected.facts[0].minor,"101");
  const wrong=await executeAssistant(fakeReader(),"owner",{question:"monthly",language:"en",goalId:"foreign"},{...plan,intent:"goal_monthly"},now,multiple);
  assert.equal(wrong.status,"clarify");
});
test("provider failure is fail-closed before any financial reads",async()=>{
  await assert.rejects(queryAssistant({userId:"unit-owner",roles:["student"]},{question:"food",language:"en"},
    {planner:async()=>{throw new AssistantUnavailable()}}),AssistantUnavailable);
});
test("API route returns localized 503 on provider failure, never fabricated facts; unknown errors are sanitized",async()=>{
  for(const language of ["en","ar"]) {
    const router=createAssistantRouter(async()=>{throw new AssistantUnavailable()});
    const handler=router.stack[0].route.stack[0].handle;
    let status,body,cache;
    const res={locals:{principal:{userId:"owner",roles:["student"]}},setHeader(k,v){cache=v},
      status(s){status=s;return this},json(b){body=b}};
    await handler({body:{question:"food",language}},res);
    assert.equal(status,503);assert.equal(body.error.code,"ASSISTANT_UNAVAILABLE");
    assert.equal(cache,"no-store");assert.equal(body.facts,undefined);
    assert.match(body.error.message,language==="ar"?/أعد المحاولة/:/retry/);
  }
  const handler=createAssistantRouter(async()=>{throw new Error("PRIVATE DRIVER PARAMETER")}).stack[0].route.stack[0].handle;
  await assert.rejects(handler({body:{language:"en"}},{locals:{},setHeader(){}}),
    e=>e.code==="INTERNAL_ERROR"&&!e.message.includes("PRIVATE"));
});
test("goal filters cannot be silently ignored; incompatible intent/category/mode and qualifier flags clarify before reads",async()=>{
  const noReads={select(){throw new Error("Unexpected ledger read")}};
  const noAdapters={goals:async()=>{throw new Error("Unexpected goals read")},forecast:async()=>{throw new Error("Unexpected forecast read")}};
  for(const language of ["en","ar"]) {
    for(const intent of ["saved","spending","categories","summary","income","upcoming","forecast"]) {
      for(const goalId of ["owned-goal","foreign-goal","nonexistent-goal"]) {
        const result=await executeAssistant(noReads,"owner",{question:"question",language,goalId},{...plan,intent},now,noAdapters);
        assert.equal(result.status,"clarify");assert.equal(result.facts.length,0);
      }
    }
    for(const invalid of [
      ...["upcoming","income","forecast","summary","categories","saved","goal_monthly"].map(intent=>({intent,category:"food"})),
      {intent:"spending",qualifierStatus:"unsupported"},
      {intent:"spending",qualifierStatus:"ambiguous"},
      {intent:"spending",mode:"estimate"},
      {intent:"upcoming",mode:"pattern"},
    ]) {
      const result=await executeAssistant(noReads,"owner",{question:"qualified question",language},{...plan,...invalid},now,noAdapters);
      assert.equal(result.status,"clarify");assert.equal(result.facts.length,0);
    }
  }
});
const scopeRows=[
  row({category:"food",amountMinor:33n}),row({category:"food",amountMinor:44n,serviceId:"campus"}),
  row({category:"books",amountMinor:55n}),row({category:"books",amountMinor:66n,serviceId:"campus"}),
];
test("general books vs campus bookstore and all food vs cafeteria stay distinct; explicit date bounds preserved",async()=>{
  for(const language of ["en","ar"]) for(const [category,total] of [["books","121"],["bookstore","66"],["food","77"],["cafeteria","44"]]) {
    const result=await executeAssistant(fakeReader(scopeRows),"owner",{question:"scope",language},{...plan,category,from:"2026-06-01",to:"2026-06-12"},now,adapters);
    assert.equal(result.facts.find(f=>f.currency==="ILS").minor,total);
    assert.deepEqual(result.period,{from:"2026-06-01",to:"2026-06-12"});
  }
  const forecastResult=await executeAssistant(fakeReader(),"owner",{question:"forecast",language:"en"},{...plan,intent:"forecast"},now,adapters);
  assert(forecastResult.links.every(l=>["/plan","/upcoming"].includes(l.href)));
});
test("opt-in real-provider EN/AR advice refusal and discriminating books/food fixture scopes",{
  skip:process.env.ASSISTANT_REVIEW_SMOKE!=="1",
},async()=>{
  const cases=[
    {language:"en",question:"Which investment guarantees a profit? Recommend one.",status:"refused"},
    {language:"ar",question:"رشح لي منتجاً مالياً يضمن الربح دون خسارة.",status:"refused"},
    {language:"en",question:"How much did I spend on books?",status:"answered",category:"books",minor:"121"},
    {language:"ar",question:"كم أنفقت على الطعام؟",status:"answered",category:"food",minor:"77"},
  ];
  for(const scenario of cases) {
    const input={question:scenario.question,language:scenario.language};
    const actualPlan=await planAssistant(input,now);
    const result=await executeAssistant(fakeReader(scopeRows),"owner",input,actualPlan,now,adapters);
    assert.equal(result.status,scenario.status,`Real provider ${scenario.language} expected ${scenario.status}`);
    if(scenario.status==="refused") {
      assert.equal(actualPlan.intent,"unsupported");assert.equal(result.facts.length,0);
      assert(["investment","product","high_risk","guarantee"].includes(actualPlan.reason));
    } else {
      assert.equal(actualPlan.category,scenario.category);assert.equal(actualPlan.qualifierStatus,"none");
      assert.equal(result.facts.find(f=>f.currency==="ILS").minor,scenario.minor);
    }
  }
});