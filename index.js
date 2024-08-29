import express from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import { DateTime, Duration } from "luxon"; // установили библиотеку для работы со временем (DateTime) npm i luxon и Duration для вычисления time remaining
import { WebSocketServer } from "ws"; // подключили websocket

const __filename = url.fileURLToPath(import.meta.url); // получаем абсолютный путь к текущему файлу к index.js
const __dirname = path.dirname(__filename); // получи директорию файла index.js
const port = 3000;
const app = express();
const timeZone = "UTC"; // если написать UTC+2 то будет немецкое время

app.use(express.static(path.join(__dirname, "public")));// добавляем возможность работать со статическими файлами

const loadBuses = async () => {
  const data = await readFile(path.join(__dirname, "buses.json"), "utf-8");
  return JSON.parse(data);
  // console.log(data);
};

// функция для получения даты и времени следующей отправки
const getNextDeparture = (firstDepartureTime, frequencyMinutes) => {
  const now = DateTime.now().setZone(timeZone); // для того чтобы показать время локальное то setZone не нужен
  const [hours, minutes] = firstDepartureTime.split(":").map(Number); // с помощью map преобразуем данные в число можно просто написать .map(Number)
  let departure = DateTime.now().set({ hours, minutes, seconds: 0, milliseconds: 0 }).setZone(timeZone);

  if (now > departure) {
    departure = departure.plus({ minutes: frequencyMinutes });
  }

  const endOfDay = DateTime.now().set({ hours: 23, minutes: 59, seconds: 59 }).setZone(timeZone);

  if (departure > endOfDay) {
    departure = departure
      .startOf("day")
      .plus({ days: 1 })
      .set({hours, minutes});
  }

  while (now > departure) {
    departure = departure.plus({ minutes: frequencyMinutes });

    if (departure > endOfDay) {
      departure = departure
        .startOf("day")
        .plus({ days: 1 })
        .set({hours, minutes});
    }
  }

  return departure
};

// функция чтобы получить данные
const sendUpdatedData = async () => {
  const buses = await loadBuses();
  const now = DateTime.now().setZone(timeZone);

  const updatedBuses = buses.map((bus) => {
    const nextDeparture = getNextDeparture(bus.firstDepartureTime, bus.frequencyMinutes);
    console.log('nextDeparture: ', nextDeparture);

    // метод diff это сравнение
    const timeRemaining = Duration.fromMillis(nextDeparture.diff(now).toMillis())
    
    return {
      ...bus,
      nextDeparture: {
        date: nextDeparture.toFormat('yyyy-MM-dd'),
        time: nextDeparture.toFormat('HH:mm:ss'),
        remaining: timeRemaining.toFormat('hh:mm:ss'),
      },
    };
  });
  return updatedBuses
};

// функция для сортировки автобусов по времени отправления
const sortBuses = (buses) => 
[...buses].sort((a, b) => 
  new Date(`${a.nextDeparture.date}T${a.nextDeparture.time}Z`) - 
  new Date(`${b.nextDeparture.date}T${b.nextDeparture.time}Z`))



app.get("/next-departure", async (req, res) => {
  try {
    const updatedBuses = await sendUpdatedData();
    const sortedBuses = sortBuses(updatedBuses);
    res.json(sortedBuses)
    
  } catch {
    res.send("error");
  }
});

const wss = new WebSocketServer({noServer: true}); // сервер без привязки к http
const clients = new Set() // чтобы к нашему серверу было несколько подключений, new Set - это объект или коллекция, которая может хранить уникальные значения

// мы подписываемся на событие, когда происходит connection то выполнится функция
wss.on('connection', (ws) => {
  console.log("WebSocket connection");
  clients.add(ws); // добавляем клиентов в коллекцию

  // функция которая будет отправлять обновленные данные клиенту. запрашивать, обновлять и отправлять
  const sendUpdates = async () => {
    const updatedBuses = await sendUpdatedData();
    const sortedBuses = sortBuses(updatedBuses);

    ws.send(JSON.stringify(sortedBuses)) // обращение к сокету и отправка данных
    try {
      
    } catch (error) {
      console.error(`Error websocket connection: ${error}`)
    }

  }

  // для этого создаем интервал
  const intervalId = setInterval(sendUpdates, 1000);

  // cобытие когда websocket завершился, например закрыли вкладку браузера
  ws.on('close', () => {
    clearInterval(intervalId);
    clients.delete(ws);
    console.log('WebSocket closed');
    
  });
  
}) // событие в node.js на которое будет реагировать, мы обрабатываем соединение с клиентом, данная функция принимает наше соединение наш websocket


// функция cоздает и возращает сервер
const server = app.listen(port, () => {
  console.log("server running on http://localhost:" + port);
});

// мы можем на сервере прослушать upgrade для http соединения, т.е. когда происходят изменения на сервере то мы эмитим(вызываем) самостоятельно connection
server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req)
  })
})
