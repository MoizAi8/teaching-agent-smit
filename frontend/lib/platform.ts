export async function api<T=any>(path:string,method="GET",body?:unknown):Promise<T> {
 const response=await fetch(`/api/v2/${path}`,{method,credentials:"same-origin",headers:{"Content-Type":"application/json"},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const data=await response.json();if(!response.ok)throw new Error(data.error?.message||"Request failed. Please try again.");return data;
}
export const topics=[
 {name:"Python",category:"Programming",description:"Think in functions, work with data, and build your first useful program.",steps:["Values and variables","Conditions and loops","Functions and collections","Build a command-line tool"]},
 {name:"HTML & CSS",category:"Web foundations",description:"Give your ideas structure, style and an accessible place on the web.",steps:["Semantic HTML","The box model","Flexbox and grid","Build a responsive page"]},
 {name:"JavaScript",category:"Programming",description:"Understand the language that brings web experiences to life.",steps:["Values and functions","Arrays and objects","DOM events","Async requests"]},
 {name:"React & Next.js",category:"Frontend development",description:"Build interfaces from components and connect them to server logic.",steps:["Components and props","State and effects","Routing","Server boundaries"]},
 {name:"Databases & APIs",category:"Backend development",description:"Design relationships, query information and build reliable interfaces.",steps:["Tables and keys","SQL queries","HTTP and REST","Transactions and authorization"]},
 {name:"Artificial intelligence",category:"AI & agentic systems",description:"Explore models, grounded retrieval and responsible tool-based workflows.",steps:["Model fundamentals","Prompt design","Retrieval and evaluation","Agent boundaries"]},
 {name:"Git & software engineering",category:"Developer tools",description:"Track changes, test assumptions and collaborate with confidence.",steps:["Commits and branches","Code review","Automated testing","Release practices"]},
 {name:"TypeScript",category:"Programming",description:"Model data clearly and catch mistakes before your program runs.",steps:["Primitive types","Interfaces and unions","Generics","Runtime validation"]},
];
