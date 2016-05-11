import * as nexus from "./index";
import * as bunyan from "bunyan";

const log = bunyan.createLogger({ name: 'nexus-demo' });

const connection = new nexus.Connection("188.164.131.164", 1717);
connection.connect().then((client) => {

   const requestTask = () => {

      client.pullTask("demo", 10).then((task) => {
         try {
            log.info("# Request: " + task);
            if (task.method == "echo") {
               if (task.parameters && task.parameters.message) {
                  task.sendResult(task.parameters.message);
               } else {
                  task.sendError(-32602, "Invalid parameter");
               }
            } else if (task.method == "fail") {
               throw new Error("Whatever you need...");
            } else {
               task.sendError(-32601, "Unknown method");
            }
         } catch (err) {
            task.sendError(-32600, "Unhandled error: " + err.toString());
         } finally {
            requestTask();
         }

      });

   };

   const rpcCall = (method, params) => {
      client.pushTask(method, params, 10).then((response) => {
         log.info("* Response: " + response);
      }).catch((err) => {
         log.error("* Received error", err);
      });
   };

   rpcCall("demo.echo", { message: "Hello World!" })
   rpcCall("demo.echo", null);
   rpcCall("demo.fail", null);
   rpcCall("demo.xxx", null);

   requestTask();

});