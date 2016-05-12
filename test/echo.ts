import * as nexus from "../lib/nexus";
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

      }).catch(err => {
         if (err.message == 'Timeout') {
            log.warn("# Timeout received");
            requestTask();
         } else {
            log.error("# Error", err);
            process.exit(-1);
         }
      });

   };

   const rpcCall = (method, params) => {
      return client.pushTask(method, params, 10).then((response) => {
         log.info("* Response: " + response);
      }).catch((err) => {
         log.error("* Received error", err);
      });
   };

   Promise.all([
      rpcCall("demo.echo", { message: "Hello\n World!" }),
      rpcCall("demo.echo", null),
      rpcCall("demo.fail", null),
      rpcCall("demo.xxx", null)
   ]).then(() => {
      log.info("All requests done -- exiting...");
      client.close();
   });

   requestTask();

});