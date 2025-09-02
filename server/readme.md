1. 新建后端目录

在你的项目根目录下，新建一个 server 文件夹：

your-project/
├── contracts/
├── frontend/   ← 你现在的 React+DApp
├── server/     ← Node.js + Express 后端

2. 初始化 Node 后端
cd server
npm init -y
npm install express mysql2 body-parser cors

3. MySQL 建表

假设数据库叫 web3u，先在 MySQL 中建表：

CREATE DATABASE IF NOT EXISTS web3u DEFAULT CHARSET utf8mb4;

USE web3u;

CREATE TABLE courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT NOT NULL,
  author VARCHAR(42) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  price_yd VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

4. 编写 server/index.js



CREATE TABLE courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT NOT NULL,
  author VARCHAR(42) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  price_yd VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


```js
app.post('/courses', async (req, res) => {
  const { courseId, author, title, content, priceYD } = req.body;
  if (!courseId || !author || !title) {
    return res.status(400).json({ error: '参数不完整' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO courses (course_id, author, title, content, price_yd) VALUES (?, ?, ?, ?, ?)',
      [courseId, author, title, content, priceYD]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '数据库写入失败' });
  }
});

```