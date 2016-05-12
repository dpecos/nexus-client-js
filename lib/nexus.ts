const net = require('net');
const events = require('events');

import * as bunyan from "bunyan";
const log = bunyan.createLogger({
   name: 'nexus-client',
   level: "info"
});

const rpc = require("jsonrpc-lite");

export class Task {
   constructor(private client: Client, private taskid: string, public path: string, public method: string, public parameters: any) {
   }
   sendResult(result: any) {
      let parameters = {
         taskid: this.taskid,
         result: result
      };
      this.client.exec("task.result", parameters);
   }
   sendError(code: number, message: string, data?: any) {
      let parameters = {
         taskid: this.taskid,
         code: code,
         message: message,
         data: data
      };
      this.client.exec("task.error", parameters);
   }
   toString(): string {
      return "{" + this.method + ": " + JSON.stringify(this.parameters) + "}";
   }
}

export class Error {
   constructor(public code: number, public message: string) {
   }
   toString(): string {
      return "{" + this.code + ": " + this.message + "}";
   }
}

export class Connection {
   private socket;
   private dataReady;

   constructor(private ip: string, private port: number) {
   }

   connect(): Promise<Client> {
      this.socket = new net.Socket();
      this.dataReady = new events.EventEmitter();

      this.socket.on("data", (data) => {
         const dataStr = data.toString().trim();
         log.debug("Nexus Connection: received data: " + dataStr);

         this.dataReady.emit("data", dataStr);
      });

      this.socket.on("error", (err) => {
         log.error("Nexus Connection - Error", err);
      });

      return new Promise<Client>((resolve, reject) => {
         this.socket.connect(this.port, this.ip, () => {
            // log.debug("Nexus Connection: connected to nexus");

            const client = new Client(this);
            this.dataReady.on("data", (data) => {
               client.dataReady(data);
            });

            resolve(client);
         });
      });
   };

   disconnect() {
      if (this.socket) {
         log.debug("Nexus Connection: closing socket to nexus server");
         this.socket.end();
         this.socket.destroy();
      }
   }

   write(data: string) {
      log.debug("Nexus Connection: sending data: " + data);
      this.socket.write(data + "\n");
   }

};

export class Client {
   private requestHandlers;
   private requestIdCounter;
   private pingHandler;

   constructor(private connection: Connection) {
      this.requestHandlers = {};
      this.requestIdCounter = 1;

      this.pingHandler = setInterval(() => {
         this.exec("sys.ping").then(() => {
            // log.debug("Nexus Client: ping sent");
         });
      }, 60 * 1000);
   }

   close() {
      clearInterval(this.pingHandler);
      
      this.connection.disconnect();
   }

   private newId(): string {
      return (this.requestIdCounter++).toString();
   }

   exec(method: string, params?: any): Promise<any> {
      const id: string = this.newId();
      const jsonrequest: string = rpc.request(id, method, params);

      return new Promise<any>((resolve, reject) => {
         this.requestHandlers[id] = [resolve, reject];
         process.nextTick(() => {
            this.connection.write(jsonrequest);
         });
      });
   };

   private handleRequest(jsonrpcMessage) {
      const response = rpc.parse(jsonrpcMessage);

      const handlers = this.requestHandlers[response.payload.id];

      if (handlers) {

         if (response.type == 'success') {
            const result = response.payload.result;
            if (result.taskid) {
               // pullTask response 
               const task = new Task(this, result.taskid, result.path, result.method, result.params);
               // log.debug("Nexus Client: new task received for " + task.path + task.method);
               handlers[0](task);
            } else {
               // pushTask response
               // log.debug("Nexus Client: RPC result received: " + JSON.stringify(result));
               handlers[0](result);
            }
         } else if (response.type == 'error') {
            const error = new Error(response.payload.error.code, response.payload.error.message)
            handlers[1](error);
         }

         delete this.requestHandlers[response.payload.id];

      } else {
         log.error("Nexus Client - Error: no promise registered for id " + response.payload.id);
      }

   }

   dataReady(data) {
      // important: on a single callback there could be multiple rpc messages in the same string
      data.toString().split("\n").forEach(jsonrpcMessage => {
         this.handleRequest(jsonrpcMessage);
      });
   }

   pullTask(prefix: string, timeout: number): Promise<Task> {
      let parameters: any = {
         prefix: prefix
      };
      if (timeout > 0) {
         parameters.timeout = timeout;
      }
      return this.exec("task.pull", parameters);
   };

   pushTask(method: string, params: any, timeout: number): Promise<any> {
      let parameters: any = {
         method: method,
         params: params
      }
      if (timeout > 0) {
         parameters.timeout = timeout;
      }

      return this.exec("task.push", parameters);
   }
}