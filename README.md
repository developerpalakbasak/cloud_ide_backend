# ⚡ Cloud IDE Backend

A production-ready **Cloud IDE Backend** that provides isolated development environments for every user.  
Each project runs inside its **own Docker container**, giving users the ability to:

- Execute Linux commands  
- Run Git commands (clone, pull, push)  
- Run Node.js / Python / Express servers  
- Manage files in real-time  
- Use fully isolated shell environments  
- Stream command output through Socket.IO  

Deployed at: **http://103.174.51.218**

---

## 🚀 Live Demo

You can access the deployed backend here:

👉 **http://103.174.51.218**

This instance demonstrates:

- Workspace creation  
- User project isolation  
- Container creation per project  
- Real-time terminal  
- Git clone support  
- Live process logging  
- Dockerized execution environment  

---

## 🛠️ Tech Stack

### **Backend**
- Node.js (ES Modules)
- Express.js
- Socket.IO
- MongoDB + Mongoose
- Dockerode (Docker SDK for Node)
- FS-Extra (file system management)
- JWT Authentication
- Cors, Morgan

### **Environment Execution**
Every project runs in its own container:

- **Node:20-alpine**
- **Python:3.12-alpine**
- **Typescript runner**
- **Express runner**

---

## 🔒 Project Isolation

Each project has:

- Its own workspace directory  
- Its own Docker container (`ide_<username>_<project>`)  
- Its own shell (`sh` inside container)  
- Its own mapped port for running dev servers  

This guarantees **security**, **performance**, and **safe multi-user execution**.

Example workspace layout:
