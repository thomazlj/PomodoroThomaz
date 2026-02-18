body {
  margin: 0;
  min-height: 100vh;
  background: radial-gradient(circle at bottom, #0f2f1f, #050505 60%);
  color: #eaeaea;
  font-family: system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 40px;
}

.status {
  padding: 8px 20px;
  border-radius: 999px;
  font-weight: 600;
  margin-bottom: 30px;
}

.timer-wrapper {
  display: flex;
  align-items: center;
  gap: 25px;
}

.timer {
  font-size: 120px;
  color: #20e070;
}

.day-total {
  font-size: 18px;
  color: #aaa;
  min-width: 150px;
}

.stats {
  display: flex;
  gap: 50px;
  margin-bottom: 30px;
  margin-top: 20px;
}

.stat {
  text-align: center;
}

.stat span {
  display: inline-block;
  font-size: 22px;
  margin-top: 5px;
}

.red span { color: #ff4d4d; }
.green span { color: #20e070; }

.controls {
  display: flex;
  gap: 15px;
  margin-bottom: 40px;
  flex-wrap: wrap;
}

button {
  padding: 14px 22px;
  font-size: 15px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}

.danger { background: #e74c3c; color: white; }
.success { background: #20e070; color: #063; }

.ghost {
  background: #111;
  color: #aaa;
  border: 1px solid #333;
}

.history {
  width: 320px;
}

.history ul {
  list-style: none;
  padding: 0;
}

.history li {
  font-size: 13px;
  padding: 6px 0;
  border-bottom: 1px solid #222;
}
