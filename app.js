const eventId = new URLSearchParams(location.search).get("id");

/* =========================
   CREATE EVENT
========================= */
async function createNewEvent() {
  const name = document.getElementById("eventName").value;
  if (!name) return alert("모임 이름을 입력해주세요.");

  const id = crypto.randomUUID();
  const link = `${location.origin}/event.html?id=${id}`;
  
  setLoading(true);
  document.getElementById("result").innerHTML = `
    <div class="card">
      <input value="${link}" onclick="this.select()" readonly />
    </div>
  `;

  await fetch(API_URL, {
    method: "POST",
    redirect: "follow",
    body: JSON.stringify({
      action: "createEvent",
      eventId: id,
      eventName: name
    })
  });
  setLoading(false);
  location.href = `event.html?id=${id}`;
}

/* =========================
   JOIN EVENT
========================= */
function normalizeInstagram(value) {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split("/")[0]
    .split("?")[0];
}

let joining = false;
async function join() {
  if (joining) return;

  joining = true;
  setLoading(true);

  try {
    const name = document.getElementById("name").value.trim();
    const userId = crypto.randomUUID();
    const instagramId = normalizeInstagram(
      document.getElementById("ig").value
    );

    if (!name) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (!instagramId) {
      alert("인스타그램 ID를 입력해주세요.");
      return;
    }

    if (!eventId) {
      alert("올바른 이벤트 접근이 아닙니다.");
      return;
    }

    const res = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      body: JSON.stringify({
        action: "join",
        eventId,
        userId,
        name,
        instagramId
      })
    });

    const result = await res.json();

    document.getElementById("name").value = "";
    document.getElementById("ig").value = "";

    if (result.status === "duplicate") {
      alert("⚠️ 이미 참여했습니다");
      return;
    }else {
      const optimisticUser = {
        eventId,
        userId,
        name,
        instagramId,
        status: "pending"
      };

      currentData.push(optimisticUser);

      render({
        eventName: lastDataObj.eventName,
        attendees: currentData
      });
      alert("🎉 등록 완료");
    }

  } catch (err) {
    currentData = currentData.filter(
      u => u.userId !== userId
    );

    render({
      eventName: lastDataObj.eventName,
      attendees: currentData
    });

    console.error(err);
    alert("네트워크 오류가 발생했습니다.");
  } finally {
    joining = false;
    setLoading(false);

    load();
  }
}

function openInstagram() {
  window.location.href = "https://instagram.com/_u/instagram";
}

/* =========================
   invite
========================= */
function shareLink() {
  const link = `${location.href}`;

  navigator.clipboard.writeText(link);

  alert("공유 링크 복사");
}

/* =========================
   REALTIME (FETCH POLLING)
========================= */
let lastData = "";
let lastDataObj = null;
let currentData = [];

async function load() {
  if (!eventId) return; 

  try {
    const res = await fetch(`${API_URL}?eventId=${eventId}`, {
      method: "GET",
      redirect: "follow"
    });
    
    if (!res.ok) throw new Error("네트워크 응답 이상");
    const data = await res.json();
    
    if (data.status === "error") {
      console.error(data.message);
      document.body.innerHTML = `
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #f8fafc;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            .error-card {
              max-width: 400px;
              width: 90%;
              background: white;
              border-radius: 20px;
              padding: 40px 30px;
              text-align: center;
              box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            }

            .error-icon {
              font-size: 56px;
              margin-bottom: 16px;
            }

            .error-title {
              font-size: 24px;
              font-weight: 700;
              color: #111827;
              margin-bottom: 10px;
            }

            .error-message {
              color: #6b7280;
              line-height: 1.5;
              margin-bottom: 28px;
            }

            .error-btn {
              display: inline-block;
              padding: 12px 24px;
              border-radius: 12px;
              background: #0095f6;
              color: white;
              text-decoration: none;
              font-weight: 600;
              transition: 0.2s;
            }

            .error-btn:hover {
              background: #0095f6;
            }
          </style>

          <div class="error-card">
            <div class="error-icon">😢</div>

            <div class="error-title">
              모임을 찾을 수 없어요
            </div>

            <div class="error-message">
              ${data.message}
            </div>

            <a class="error-btn" href="../index.html">
              모임 생성하러 가기
            </a>
          </div>
        `;

        return;
    }

    const currentDataStr = JSON.stringify(data.attendees);
    if (lastData !== currentDataStr) {
      lastData = currentDataStr;
      render(data);
      updateParticipantStats();
    }
  } catch (error) {
    console.error("데이터를 가져오는 중 오류 발생:", error);
  }
}

/* =========================
   RENDER LIST (NOTION STYLE)
========================= */
function setTitle(name) {
  const titleEl = document.getElementById("title");
  if (titleEl && name) {
    titleEl.innerText = `📍 ${name}`;
  }
}

async function saveTitleEdit(value) {
  try {
    value = value.trim();
    if(!value) return;

    setTitle(value);

    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "updateEventName",
        eventId,
        eventName: value
      })
    });

    const result = await res.json();

    if (result.status !== "ok") {
      console.warn("event name update failed:", result);
    }

  } catch (err) {
    console.error("saveTitleEdit error:", err);
    alert("저장되지 않았습니다. 다시 시도해주세요.");
  }
}

function bindTitleClick() {
  const titleEl = document.getElementById("title");

  titleEl.onclick = async () => {
    const current = titleEl.innerText.replace("📍 ", "");

    const value = prompt("모임 이름 수정", current);

    if (!value || !value.trim()) return;

    await saveTitleEdit(value.trim());
  };
}

function render(data) {
  lastDataObj = data;
  setTitle(data.eventName);
  currentData = data.attendees || [];

  const list = document.getElementById("list");
  if (!list) return;

  if (data.length === 0) {
    list.innerHTML = `<div class="card" style="color: #aaa;">아직 참가자가 없습니다.</div>`;
    return;
  }
  
  const keyword = document.getElementById("name")?.value || document.getElementById("ig")?.value || "";

  const match = (u) =>
    String(u.name ?? "").includes(keyword) ||
    String(u.instagramId ?? "").includes(keyword);

  const sortedData = [...currentData].sort((a, b) => {
    return match(b) - match(a);
  });

  list.innerHTML = sortedData.map(u => `
    <div class="user" data-user-id="${u.userId}" data-instagram-id="${u.instagramId}">
      <div class="user-info-group">
        <a href="https://instagram.com/${u.instagramId}" class="no-style" target="_blank" rel="noopener noreferrer">
          <div class="avatar">
            <div class="avatar-inner">
              👤
            </div>
          </div>
        </a>
        <button class="unstyled-button" onclick="copy('@${u.instagramId}')">
          <div class="user-meta">
            <span class="name">${u.name}</span>
            <span class="ig">@${u.instagramId}</span>
          </div>
        </button>
      </div>

      <span class="badge ${u.status}" onclick="toggleStatus('${u.userId}', '${u.status}')">
        ${u.status === 'confirmed' ? '확정' : '대기'}
      </span>
    </div>
  `).join("");
}

function showSuggestions() {
  if (lastDataObj) {
    render(lastDataObj);
  }
}

/* =========================
   COPY IG
========================= */
function copy(text) {
  navigator.clipboard.writeText(text);
  alert(text + " 복사");
}

let currentFilter = "all";
function copyAllIG(data, statusType) {
  let filteredList;

  if(statusType === "all"){
    filteredList = data.attendees;
  }else{
    filteredList = data.attendees.filter(u=> u.status === statusType);
  }

  const all = filteredList.map(u => `@${u.instagramId}`).join("\n");

  navigator.clipboard.writeText(all);

  alert(`${statusType === "all" ? "전체" : statusType === "pending" ? "대기" : "참여"} 인스타 ID 복사`);
}

/* =========================
   loading
========================= */
let loading = false;

function setLoading(state) {
  loading = state;
  document.body.classList.toggle("loading", state);
}

/* =========================
   STATUS TOGGLE
========================= */
async function toggleStatus(userId, status) {
  const newStatus = status === "pending" ? "confirmed" : "pending";
  
  const target = currentData.find(u => u.userId === userId);
  if (!target) return;

  const prevStatus = target.status;
  target.status = newStatus;

  render({
    eventName: lastDataObj.eventName,
    attendees: currentData
  });
  
  try{
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "updateStatus",
        eventId,
        userId,
        status: newStatus
      })
    });
    
  } catch(err){
    target.status = prevStatus;

    render({
      eventName: lastDataObj.eventName,
      attendees: currentData
    });

    alert("상태 변경 실패");
    console.error(err);
  } 
}

/* =========================
   FILTER UI
========================= */
function filterStatus(type) {
  currentFilter = type;

  const users = document.querySelectorAll("#list .user");

  users.forEach(user => {
    const actions = user.nextElementSibling; 
    const badge = user.querySelector(".badge");
    
    const isMatch = (type === "all") || (badge && badge.classList.contains(type));

    if (isMatch) {
      user.style.display = "flex";
      if (actions && actions.classList.contains("actions")) {
        actions.style.display = "flex";
      }
    } else {
      user.style.display = "none";
      if (actions && actions.classList.contains("actions")) {
        actions.style.display = "none";
      }
    }
  });
}

function updateParticipantStats(nodes) {
  const users = document.querySelectorAll("#list .user");

  let total = 0;
  let confirmed = 0;
  let pending = 0;

  users.forEach(user => {
    if (user.style.display === "none") return;

    const badge = user.querySelector(".badge");
    const isConfirmed = badge?.classList.contains("confirmed");

    total++;

    if (isConfirmed) confirmed++;
    else pending++;
  });

  document.getElementById("participantStats").textContent =
    `(${total}명 · 확정 ${confirmed} · 대기 ${pending})`;
}

/* =========================
   UPDATE
========================= */
function editName(userId, current) {
  const name = prompt("이름 수정", current);

  if (!name) return;

  const target = currentData.find(u=> u.userId === userId);
  if(!target) return;

  const prevName = target.name;

  target.name = name;

  render({
    eventName: lastDataObj.eventName,
    attendees: currentData
  });

  try{
    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "updateUserName",
        eventId,
        userId,
        name
      })
    });
  } catch(err){
    target.name = prevName;

    render({
      eventName: lastDataObj.eventName,
      attendees: currentData
    });

    alert("이름 수정 실패");
  }

  load();
}

async function editInstagram(userId, current) {
  const ig = prompt("인스타그램 ID 수정", current);
  if (!ig) return;

  const target = currentData.find(u=> u.userId === userId);
  if(!target) return;

  setLoading(true);
  const prevInstagram = target.instagramId;

  target.instagramId = ig;

  try{
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "updateInstagram",
        eventId,
        userId,
        instagramId: ig
      })
    });
    
    const result = await res.json();
    setLoading(false);
    if(result.status === "duplicate") {
      alert("이미 사용 중인 인스타그램 ID입니다.");
      return;
    }

    if(result.status !== "ok"){
      alert("수정 실패");
      return;
    }

    render({
      eventName: lastDataObj.eventName,
      attendees: currentData
    });

  } catch(err){
    target.instagramId = prevInstagram;

    render({
      eventName: lastDataObj.eventName,
      attendees: currentData
    });

    alert("인스타그램 ID 수정 실패");
  }
}

/* =========================
   DELETE EVENT
========================= */
let longPressTriggered = false;
function bindLongPress() {
  let timer = null;

  const start = (e) => {
    const el = e.target.closest(".user");
    if (!el) return;

    timer = setTimeout(() => {
      handleLongPress(e.target);
    }, 600);
  };

  const cancel = () => {
    clearTimeout(timer);
    timer = null;
    targetEl = null;
  };

  // 모바일
  document.addEventListener("touchstart", start, { passive: true });
  document.addEventListener("touchend", cancel);
  document.addEventListener("touchmove", cancel);

  // PC
  document.addEventListener("mousedown", start);
  document.addEventListener("mouseup", cancel);
  document.addEventListener("mouseleave", cancel);

}

function handleLongPress(target) {
  const userEl = target.closest(".user");
  if (!userEl) return;

  const userId = userEl.dataset.userId;

  if (target.closest(".name")) {
    editName(userId, target.innerText);
    return;
  }

  if (target.closest(".ig")) {
    editInstagram(userId, target.innerText.replace("@", ""));
    return;
  }

  removeUser(userId);
}

async function deleteEvent() {
  if (!confirm("모임을 삭제하시겠습니까?")) return;
  setLoading(true);
  await fetch(API_URL, {
    method: "POST",
    redirect: "follow",
    body: JSON.stringify({
      action: "deleteEvent",
      eventId
    })
  });
  alert(location.href);
  alert(location.pathname);
  alert(document.baseURI);
  location.href = "./index.html";
  setLoading(false);
  alert("삭제 완료");
}

async function removeUser(userId) {

  if (!confirm("삭제하시겠습니까?")) return;

  const index = currentData.findIndex(u=> u.userId === userId);
  if(index === -1) return;

  const removedUser = currentData[index];

  currentData.splice(index, 1);

  render({
      eventName: lastDataObj.eventName,
      attendees: currentData
    });
  
  try{
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "deleteUser",
        eventId,
        userId
      })
    });
  } catch(err){
    currentData.splice(index, 0, removedUser);

    render({
      eventName: lastDataObj.eventName,
      attendees: currentData
    });

    alert("삭제 실패");
  }
}

/* =========================
   INITIALIZATION (초기 실행 제어)
========================= */
document.addEventListener("DOMContentLoaded", () => {
  const createBtn = document.getElementById("btnCreateEvent");
  if (createBtn) {
    createBtn.addEventListener("click", createNewEvent);
    console.log("모임 생성 페이지 준비 완료. 생성 버튼 이벤트 연결됨.");
  }

  bindLongPress();

  if (eventId) {
    console.log(`이벤트 ID (${eventId}) 감지 - 실시간 데이터 로딩을 시작합니다.`);
    load();
    setInterval(load, 3000);
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("eventTitle");

  if (saved) {
    setTitle(saved);
  }

  bindTitleClick();
});

