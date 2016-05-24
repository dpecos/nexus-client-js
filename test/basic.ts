import * as nexus from "../lib/nexus";
import * as bunyan from "bunyan";

import * as chai from "chai"
chai.should();

const log = bunyan.createLogger({ name: 'nexus-demo', level: "error"});

const NEXUS_HOST = "nexus.n4m.zone";
const NEXUS_PORT = 1717;
const NEXUS_USER = "root";
const NEXUS_PASSWD = "root";

describe("Client/Server interaction", () => {

   before((done) => {
      const serverConnection = new nexus.Connection(NEXUS_HOST, NEXUS_PORT);
      serverConnection.connect().then((client) => {

         const requestTask = () => {

            client.pullTask("demo", 1).then((task) => {

               try {
                  log.info("# Request: " + task + " - (" + JSON.stringify(task.tags) + ")");
                  if (task.method == "echo") {
                     if (task.parameters && task.parameters.message) {
                        task.sendResult(task.parameters.message);
                     } else {
                        task.sendError(nexus.Error.INVALID_PARAMS);
                     }
                  } else if (task.method == "fail") {
                     throw new Error("Whatever you need...");
                  } else if (task.method == "timeout") {
                     setTimeout(() => {
                        task.sendResult("Too late :-)");
                     }, 2000);
                  } else if (task.method == "shutdown") {
                     task.sendResult("As you wish").then(() => {
                        log.info("# Closing server...");
                        client.close();
                     });

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
               } else if (err.code === nexus.Error.TIMEOUT.code) {
                  log.warn("# Timeout received");
               } else {
                  log.error("# Error", err);
               }
               requestTask();
            });

         };

         log.info("# Server logging in into nexus...");

         client.login(NEXUS_USER, NEXUS_PASSWD)
            .then(() => {
               done();
            })
            .then(() => {
               requestTask();
            }).catch(err => {
               log.error("# Could not log in", err);
               client.close();
            });

      }).catch(err => {
         log.error("# Could not connect to nexus", err);
      });
   });

   describe("Client connection", () => {

      let test_client = null;
      let rpcCall = null;

      before((done) => {
         let client = null;

         const clientConnection = new nexus.Connection(NEXUS_HOST, NEXUS_PORT);
         clientConnection.connect().then((client) => {

            rpcCall = (method, params) => {
               return client.pushTask(method, params, 1);
            };

            test_client = client;

            log.info("* Client logging in into nexus...");

            client.login(NEXUS_USER, NEXUS_PASSWD)
               .then(() => {
                  done();
               })
               .catch(err => {
                  log.error("* Could not log in", err);
                  client.close();
                  done(err);
               });

         }).catch(err => {
            log.error("* Could not connect to nexus", err);
            done(err);
         });
      });


      after((done) => {
         log.info("* All requests done -- exiting...");
         rpcCall("demo.shutdown", null).then(() => {
            test_client.close();
            done();
         });

      });

      it("should properly echo a multiline string", (done) => {
         rpcCall("demo.echo", { message: "Hello\n World!" }).then((response) => {
            response.should.equal("Hello\n World!");
         })
         .then(done).catch(done);
      });
      
      it("should throw with unexpected empty parameters", (done) => {
         rpcCall("demo.echo", null).then((response) => {
            chai.assert.fail("This has to fail");
         })
         .catch((err) => {
            err.code.should.equal(nexus.Error.INVALID_PARAMS.code);
         })
         .then(done).catch(done);
      });
      
      it("should throw with unhandled error", (done) => {
         rpcCall("demo.fail", null).then((response) => {
            chai.assert.fail("This has to fail");
         })
         .catch((err) => {
            err.code.should.equal(nexus.Error.INTERNAL.code);
         })
         .then(done).catch(done);
      });
      
            
      it("should throw with not found methods", (done) => {
         rpcCall("demo.xxx", null).then((response) => {
            chai.assert.fail("This has to fail");
         })
         .catch((err) => {
            err.code.should.equal(nexus.Error.METHOD_NOT_FOUND.code);
         })
         .then(done).catch(done);
      });
      
      it("should throw with timeout", (done) => {
         rpcCall("demo.timeout", null).then((response) => {
            chai.assert.fail("This has to fail");
         })
         .catch((err) => {
            err.code.should.equal(nexus.Error.TIMEOUT.code);
         })
         .then(done).catch(done);
      });

   });
});