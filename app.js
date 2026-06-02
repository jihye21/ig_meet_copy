const eventId = new URLSearchParams(location.search).get("id");

/* =========================
   CREATE EVENT
========================= */
async function createNewEvent() {
  const name = document.getElementById("eventName").value;
  const id = Math.random().toString(36).substring(2, 8);

  const link = `${location.origin}/event.html?id=${id}`;

  document.getElementById("result").innerHTML = `
    <div class="card">
      <input value="${link}" onclick="this.select()" readonly />
    </div>
  `;

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "createEvent",
      eventId: id,
      eventName: name
    })
  });
}

/* =========================
   JOIN EVENT
========================= */
async function join() {
  const name = document.getElementById("name").value;
  const instagramId = document.getElementById("ig").value.replace("@","");

  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "join",
      eventId,
      name,
      instagramId
    })
  });

  const result = await res.json();

  if (result.status === "duplicate") {
    alert("⚠️ 이미 참여했습니다");
    return;
  }

  load();
}

/* =========================
   REALTIME (POLLING)
========================= */
let lastData = "";

function load() {
  const script = document.createElement("script");

  script.src = `${API_URL}?eventId=${eventId}&callback=render`;

  document.body.appendChild(script);
}

setInterval(load, 3000);

/* =========================
   RENDER LIST (NOTION STYLE)
========================= */
function render(data) {
  const list = document.getElementById("list");
  if (!list) return;

  list.innerHTML = data.map(u => `
    <div class="card">

      <div class="user">
        <div>
          <div class="name">${u.name}</div>
          <div class="ig">@${u.instagramId}</div>
        </div>

        <div class="badge ${u.status}">
          ${u.status}
        </div>
      </div>

      <div class="actions">
        <button onclick="copy('@${u.instagramId}')">복사</button>
        <button onclick="toggleStatus('${u.instagramId}', '${u.status}')">
          상태 변경
        </button>
      </div>

    </div>
  `).join("");
}

/* =========================
   COPY IG
========================= */
function copy(text) {
  navigator.clipboard.writeText(text);
  alert("복사됨: " + text);
}

/* =========================
   STATUS TOGGLE
========================= */
async function toggleStatus(instagramId, status) {
  const newStatus = status === "pending" ? "confirmed" : "pending";

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "updateStatus",
      eventId,
      instagramId,
      status: newStatus
    })
  });

  load();
}

/* =========================
   FILTER UI
========================= */
function filterStatus(type) {
  const cards = document.querySelectorAll(".card");

  cards.forEach(c => {
    if (type === "all") {
      c.style.display = "block";
    } else {
      c.style.display = c.innerText.includes(type) ? "block" : "none";
    }
  });
}

/* =========================
   DELETE EVENT
========================= */
async function deleteEvent() {
  if (!confirm("모임 삭제?")) return;

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "deleteEvent",
      eventId
    })
  });

  alert("삭제 완료");
  location.href = "/";
}

load();