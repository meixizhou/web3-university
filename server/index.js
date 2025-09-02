import express from "express"
import bodyParser from "body-parser"
import cors from "cors"
import mysql from "mysql2/promise"
import { ethers } from "ethers"
// 合约 ABI 和地址
import CourseManagerABI from "./abi/CourseManager.json" assert { type: "json" }

const app = express()
app.use(cors())
app.use(bodyParser.json())

// MySQL 连接
const db = await mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "web3_university",
})

// 以太坊连接
const CONTRACT_ADDRESS = import.meta.env.VITE_COURSEMANA
const PROVIDER_URL = import.meta.env.VITE_COURSEMANA
const provider = new ethers.JsonRpcProvider(PROVIDER_URL)
const contract = new ethers.Contract(CONTRACT_ADDRESS, CourseManagerABI.abi, provider)

// 监听购买课程
contract.on("CoursePurchased", async (id, buyer, priceYD) => {
  console.log("CoursePurchased:", id, buyer, priceYD.toString())
  try {
    await db.query(
      "INSERT IGNORE INTO purchased (courseId, buyer, priceYD) VALUES (?, ?, ?)",
      [id, buyer, priceYD.toString()]
    )
  } catch (err) {
    console.error("DB insert purchase error:", err)
  }
})

app.get("/user/check", async (req, res) => {
  const { address } = req.query
  if (!address) {
    return res.status(400).json({ error: "缺少 address" })
  }

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE address=?", [address])
    if (rows.length > 0) {
      res.json({ exists: true, nickname: rows[0].nickname })
    } else {
      res.json({ exists: false })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "服务器错误" })
  }
})

/**
 * 用户登录/注册：保存签名和昵称
 */
app.post("/user/login", async (req, res) => {
  const { address, signature, nickname } = req.body
  if (!address || !signature) {
    return res.status(400).json({ error: "参数缺失" })
  }

  try {
    // 校验签名是否来自该地址
    const message = `web3-university-login-${address}`
    const recovered = ethers.verifyMessage(message, signature)
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: "签名无效" })
    }

    // 插入或更新用户
    await db.query(
      `INSERT INTO users (address, signature, nickname) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE signature = VALUES(signature), nickname = VALUES(nickname)`,
      [address, signature, nickname || ""]
    )

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "服务器错误" })
  }
})

/**
 * 修改昵称
 */
app.post("/user/update-nickname", async (req, res) => {
  const { address, nickname } = req.body
  if (!address || !nickname) {
    return res.status(400).json({ error: "参数缺失" })
  }

  try {
    await db.query("UPDATE users SET nickname=? WHERE address=?", [nickname, address])
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "服务器错误" })
  }
})

// 创建课程
app.post("/courses", async (req, res) => {
  try {
    const { id, author, title, cover, description, content, price, createdAt } = req.body
    await db.query(
      "INSERT INTO courses (id, author, title, cover, description, content, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, author, title, cover, description, content, price, createdAt]
    )
    res.json({ id, author, title, cover, description, content, price, createdAt })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "课程保存失败" })
  }
})

// 获取课程列表
// mode=all 返回所有课程 + purchased 状态
// mode=mine 只返回用户购买过的课程
app.get("/courses", async (req, res) => {
  const { address, mode } = req.query
  if (!address) return res.status(400).json({ error: "缺少 address" })

  try {
    if (mode === "mine") {
      // 用户购买的课程
      const [rows] = await db.query(
        `SELECT c.id, c.author, c.title, c.cover, c.description, c.content, c.price, c.created_at
         FROM courses c
         INNER JOIN purchased p ON c.id = p.courseId
         WHERE p.buyer = ?`,
        [address]
      )
      return res.json(rows)
    }
    // 1. 校验用户是否签过名（已注册）
    const [users] = await db.query("SELECT * FROM users WHERE address=?", [address])
    if (users.length === 0) {
      return res.status(403).json({ error: "未认证用户" })
    }

    // 默认返回全部课程 + 是否已购买
    const [rows] = await db.query(
      `SELECT c.id,
              c.author,
              c.title, 
              c.cover, 
              c.description, 
              c.content, 
              c.price,
              c.created_at,
              CASE WHEN p.id IS NOT NULL THEN TRUE ELSE FALSE END AS purchased
       FROM courses as c
       LEFT JOIN purchased as p
              ON c.id = p.courseId
             AND p.buyer = ?`,
      [address]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "数据库错误" })
  }
})

app.get("/course/purchased", async (req, res) => {
  const { address } = req.query
  if (!address) return res.status(400).json({ error: "缺少 address" })

  try {
    // 1. 校验用户是否签过名（已注册）
    const [users] = await db.query("SELECT * FROM users WHERE address=?", [address])
    if (users.length === 0) {
      return res.status(403).json({ error: "未认证用户" })
    }

    // 2. 查询数据库里的课程信息
    const [courses] = await db.query(
      "SELECT * FROM courses WHERE id IN (SELECT courseId FROM purchased WHERE address=?)",
      [address]
    )

    res.json(courses)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "服务器错误" })
  }
})



/**
 * 获取已购买课程详情
 */
app.post("/course-detail", async (req, res) => {
  const { courseId, address } = req.body
  if (!courseId || !address) {
    return res.status(400).json({ error: "参数缺失" })
  }

  try {
    // 校验该用户是否已存签名（即已登录）
    const [users] = await db.query("SELECT * FROM users WHERE address=?", [address])
    if (users.length === 0) {
      return res.status(401).json({ error: "用户未注册" })
    }

    // 校验链上是否已购买
    const purchased = await contract.purchased(courseId, address)
    if (!purchased) {
      return res.status(403).json({ error: "未购买该课程" })
    }

    // 返回课程详情
    const [rows] = await db.query(
      "SELECT id, title, content, price FROM courses WHERE id=?",
      [courseId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: "课程不存在" })
    }

    res.json({
      ...rows[0],
      nickname: users[0].nickname,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "服务器错误" })
  }
})


app.listen(3001, () => {
  console.log("后端运行在 http://localhost:3001")
})
