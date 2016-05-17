import * as nexus from "./lib/nexus";
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
                  task.sendError(nexus.Error.INVALID_PARAMS);
               }
            } else if (task.method == "fail") {
               throw new Error("Whatever you need...");
            } else {
               task.sendError(nexus.Error.METHOD_NOT_FOUND);
            }
         } catch (err) {
            log.error("# Uncaught error", err);
            task.sendError(nexus.Error.INTERNAL, err.toString());
         } finally {
            requestTask();
         }

      }).catch(err => {
         if (err.code === nexus.Error.CANCEL.code) {
            log.warn("# Request cancelled. Probably connection was lost. Exiting...")
         } else {
            if (err.message == 'Timeout') {
               log.warn("# Timeout received");
            } else {
               log.error("# Error", err);
            }
            requestTask();
         }
      });

   };

   const rpcCall = (method, params) => {
      return client.pushTask(method, params, 10).then((response) => {
         log.info("* Response: " + response);
      }).catch((err) => {
         log.error("* Error received:", err);
      });
   };

   log.info("Logging in into nexus...");

   client.login("root", "root").then(() => {

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

   }).catch(err => {
      log.error("Could not log in", err);
      client.close();
   });

}).catch(err => {
   log.error("Could not connect to nexus", err);
});