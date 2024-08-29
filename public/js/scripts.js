// функция которая делает запрос и заполняет нашу таблицу

const fetchBusData = async () => {
 try {
  const response = await fetch("/next-departure")
  if (!response.ok) {
    throw new Error(`http error! status: ${response.status}`)
  }
  const buses = response.json();
  return buses;
 } catch (error) {
  console.error(`error fetching bus data: ${error}`)
  
 }
}

const formatDate = (date) => date.toISOString().split("T")[0];
const formatTime = (date) => date.toTimeString().split(" ")[0].slice(0, 5);

const getTimeRemainingSeconds = (departureTime) => {
const now = new Date();
const timeDifference = departureTime - now
return Math.floor(timeDifference / 1000)
}

const renderBusData = (buses) => {
  const tableBody = document.querySelector("#bus tbody");
  tableBody.textContent = "";
  
  buses.forEach(element => {
    const row = document.createElement('tr')
    const nextDepartureDateTimeUTC = new Date(`${element.nextDeparture.date}T${element.nextDeparture.time}Z`)

    const remainingSeconds = getTimeRemainingSeconds(nextDepartureDateTimeUTC)

    const remainingTimeText = remainingSeconds < 60 ? 'the bus is departing' : element.nextDeparture.remaining;


    row.innerHTML = `
    <td>${element.busNumber}</td>
    <td>${element.startPoint} - ${element.endPoint}</td>
    <td>${formatDate(nextDepartureDateTimeUTC)}</td>
    <td>${formatTime(nextDepartureDateTimeUTC)}</td>
    <td>${remainingTimeText}</td>
    `
    tableBody.append(row);
  });
  
}

// wss это как https, a ws это как http (когда на хостинге то надо wss, когда локально то ws)
const initWebSocket = () => {
  const ws = new WebSocket(`ws://${location.host}`);

  // событие при open
  ws.addEventListener('open', () => {
    console.log('webSocket connection');
    
  })

  ws.addEventListener('message', (event) => {
    const buses = JSON.parse(event.data);
    renderBusData(buses);
  })

  ws.addEventListener('error', (error) => {
   console.log(`webSocket error connection: ${error}`);
   
  })
  ws.addEventListener('close', () => {
   console.log('webSocket connection closed');
   
  })
}


// ф-я который обновляет время
const updateTime = () => {
  const currentTimeElement = document.getElementById('current-time')
  const now = new Date();
  currentTimeElement.textContent = now.toTimeString().split(' ')[0];

//   setTimeout(()=>{
//     updateTime
//   },1000)
// }

setTimeout(updateTime,1000)
}

const init = async () => {
  const buses = await fetchBusData()
  renderBusData(buses);

  initWebSocket();
  updateTime();
}

init()