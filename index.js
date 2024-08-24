import express from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import { DateTime } from "luxon"; // установили библиотеку для работы со временем npm i luxon

const __filename = url.fileURLToPath(import.meta.url); // получаем абсолютный путь к текущему файлу к index.js
const __dirname = path.dirname(__filename); // получи директорию файла index.js
const port = 3000;
const app = express();
const timeZone = "UTC+2"; // если написать UTC+2 то будет немецкое время

const loadBuses = async () => {
  const data = await readFile(path.join(__dirname, "buses.json"), "utf-8");
  return JSON.parse(data);
  // console.log(data);
};

const getNextDeparture = (firstDepartureTime, frequencyMinutes) => {
  const now = DateTime.now().setZone(timeZone); // для того чтобы показать время локальное то setZone не нужен

  const [hours, minutes] = firstDepartureTime.split(":").map(Number); // с помощью map преобразуем данные в число или можно просто написать .map(Number)

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

const sendUpdatedData = async () => {
  const buses = await loadBuses();
  // console.log(buses);

  const updatedBuses = buses.map((bus) => {
    const nextDeparture = getNextDeparture(bus.firstDepartureTime, bus.frequencyMinutes);
    console.log('nextDeparture: ', nextDeparture);
    
    return {
      ...bus,
      nextDeparture: {
        data: nextDeparture.toFormat('yyyy-MM-dd'),
        time: nextDeparture.toFormat('HH:mm:ss'),
      },
    };
  });
  return updatedBuses
};

app.get("/next-departure", async (req, res) => {
  try {
    const updatedBuses = await sendUpdatedData();
    let nextDepartureData = updatedBuses.map(item => item.nextDeparture.data);
    let nextDepartureTime = updatedBuses.map(item => item.nextDeparture.time);
    console.log("nextDepartureData: ", nextDepartureData.sort())
    console.log("nextDepartureTime: ", nextDepartureTime.sort())
    
    // console.log("updatedBuses: ", updatedBuses);


    res.json(updatedBuses)
    
  } catch {
    res.send("error");
  }
});

app.listen(port, () => {
  console.log("server running on http://localhost:" + port);
});
