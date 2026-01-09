const io = require("socket.io")(3000, {
  cors: { origin: "*" }
})

let users = []

io.on("connection", socket => {

  socket.on("join", name => {
    users.push({ id: socket.id, name })
    io.emit("users", users.map(u => u.name))
  })

  socket.on("message", msg => {
    io.emit("message", msg)
  })

  socket.on("disconnect", () => {
    users = users.filter(u => u.id !== socket.id)
    io.emit("users", users.map(u => u.name))
  })

})

