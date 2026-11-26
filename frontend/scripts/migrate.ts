import { loadEnvConfig } from "@next/env";
import { migrate, closeDB } from "../server/db";
loadEnvConfig(process.cwd(),true,{info(){},error(){}});
migrate().then(()=>console.log("Schema version 1 is ready.")).catch(()=>{console.error("Migration failed. Check database access; no sensitive diagnostics printed.");process.exitCode=1;}).finally(closeDB);
