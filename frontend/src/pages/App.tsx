
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { useAuth } from "../hooks/useAuth"
import YD_ABI from '../abi/MetaCoin.json'
import CM_ABI from '../abi/CourseManager.json'
import { v4 as uuidv4 } from "uuid"


type Course = {
  id: bigint
  author: string
  title: string
  content: string
  priceYD: bigint
  active: boolean
}

const container: React.CSSProperties = { maxWidth: 1080, margin: '0 auto', padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }
const card: React.CSSProperties = { border: '1px solid #ddd', padding: 12, borderRadius: 12, boxShadow: '0 1px 5px rgba(0,0,0,.06)', marginBottom: 12 }

export default function App () {
  const { provider, signer, address, nickname, isAuthenticated, connectWallet, updateNickname, getPurchasedCourses } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [name, setName] = useState<string>('')
  const [signedName, setSignedName] = useState<string>('')
  const [creating, setCreating] = useState({ title: '', cover:'', description: '', content: '', price: '10' })
  const [swapInput, setSwapInput] = useState<string>('0.01')
  const [courseDetail, setCourseDetail] = useState<any | null>(null)
  const [purchasedCourses, setPurchasedCourses] = useState<any[]>([])

  const YDToken = import.meta.env.VITE_YDTOKEN as string
  const CourseManager = import.meta.env.VITE_COURSEMANA as string

  const cm = useMemo(() => signer && new ethers.Contract(CourseManager, CM_ABI.abi as any, signer), [signer])
  const yd = useMemo(() => signer && new ethers.Contract(YDToken, YD_ABI.abi as any, signer), [signer])

  async function loadCourses() {
    const res1 = await fetch(`/courses?address=${address}&mode=all`)
    const allCourses = await res1.json()
    setCourses(allCourses)
  }

  useEffect(() => { loadCourses() }, [cm, address])

  // 🚀 新增：ETH 兑换 YD 功能
  async function swapETHToYD() {
    if (!cm || !yd) return
    try {
      const ethAmount = ethers.parseEther(swapInput || '0')
      const rate = await cm.exchangeRateEthPerYD()
      const ydOut = ethAmount * 10n ** 18n / rate
      const tx = await cm.buyYD({ value: ethAmount })
      await tx.wait()
      alert(`兑换成功，获得 ${ethers.formatUnits(ydOut, 18)} YD`)
    } catch (err) {
      console.error(err)
      alert('兑换失败')
    }
  }

  async function approve(id: bigint, priceYD) {
    if (!cm || !yd) return
    const tx1 = await yd.approve(cm.target, priceYD)
    await tx1.wait()
  }

  async function buyCourse(id: bigint, author, priceYD) {
    if (!cm || !yd) return
    const tx2 = await cm.buyWithYD(id, author, priceYD)
    await tx2.wait()
    await loadCourses()
    alert('购买成功')
  }

  async function createCourse(course: {
    title: string
    cover: string
    description: string
    content: string
    price: number
  }) {
    try {
      // 1. 生成课程 ID
      const courseId = uuidv4()

      // 2. 上链（只存 courseId）
      const tx = await cm.createCourse(courseId)
      await tx.wait()

      // 3. 调用后端 API 存入 MySQL
      const res = await fetch("http://localhost:3001/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: courseId,
          author: address,
          ...course,
          createdAt: new Date().toISOString(),
        }),
      })

      if (!res.ok) throw new Error("后端保存失败")
      const saved = await res.json()
      console.log("课程已创建：", saved)

      loadCourses()
      return courseId
    } catch (err) {
      console.error("创建课程失败", err)
      throw err
    }
  }

  // 获取课程详情（签名 + 后端验证）
  async function getCourseDetail(courseId: number) {
    const addr = await signer.getAddress()

    const message = `request-course-${courseId}`
    const signature = await signer.signMessage(message)

    const res = await fetch("http://localhost:3001/course-detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, address: addr, signature }),
    })

    const data = await res.json()
    if (data.error) {
      alert(data.error)
    } else {
      setCourseDetail(data)
    }
  }

  // 获取已购买课程
  const handleLoadCourses = async () => {
    const list = await getPurchasedCourses()
    setPurchasedCourses(list)
  }



  async function signName() {
    if (!signer) return
    const msg = `Web3U-SetName:${name}`
    const sig = await signer.signMessage(msg)
    const payload = JSON.stringify({ name, sig, address })
    localStorage.setItem('web3u_profile', payload)
    setSignedName(name)
  }

  useEffect(() => {
    const raw = localStorage.getItem('web3u_profile')
    if (raw) {
      try { const p = JSON.parse(raw); setSignedName(p.name) } catch {}
    }
  }, [])

  return (
    <div style={container}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h2>Web3大学 · 原型</h2>
        <div>
          {!isAuthenticated ? (
            <button onClick={connectWallet}>连接钱包</button>
          ) : (
            <div>
              <p>已登录地址: {address.slice(0,6)}...{address.slice(-4)}</p>
              <p>昵称: {nickname || "未设置"}</p>
            </div>
          )}
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16}}>
        <div>
          <h3>课程市场</h3>
          {courses.length === 0 && <p>暂无课程。作者可在右侧创建。</p>}
          {courses.map(c => (
            <div key={String(c.id)} style={card}>
              <h4>{c.title} <small>#{String(c.id)}</small></h4>
              <p>{c.content}</p>
              <p>价格：{ethers.formatUnits(c.priceYD, 18)} YD</p>
              <div style={{display:'flex', gap: 8}}>
                <button onClick={() => approve(c.id, c.priceYD)}>Approve</button>
                <button onClick={() => buyCourse(c.id, c.author, c.priceYD)}>购买课程</button>
                {/* <button onClick={() => getCourseDetail(c.id)}>查看详情</button> */}
                {/* <button onClick={() => buyWithETH(c.id)}>用ETH购买(模拟)</button> */}
              </div>
            </div>
          ))}
        </div>
        <div>

      {courseDetail && (
        <div style={{ marginTop: 20, padding: 10, border: "1px solid #ccc" }}>
          <h3>课程详情</h3>
          <p>ID: {courseDetail.course_id}</p>
          <p>标题: {courseDetail.title}</p>
          <p>内容: {courseDetail.content}</p>
          <p>价格: {courseDetail.price} YD</p>
        </div>
      )}
        </div>

        <div>
          {/* 🚀 兑换 YD 币 UI */}
          <div style={card}>
            <h4>兑换 YD 币</h4>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <input
                value={swapInput}
                onChange={e=>setSwapInput(e.target.value)}
                placeholder="输入 ETH 数量"
              />
              <span>ETH</span>
              <button onClick={swapETHToYD}>兑换</button>
            </div>
            <p style={{opacity:.7, marginTop:4}}>使用 ETH 按汇率兑换成 YD 代币</p>
          </div>
          <h3>作者中心</h3>
          <div style={card}>
            <h4>创建课程</h4>
            <div style={{display:'grid', gap: 8}}>
              <input placeholder='课程标题' value={creating.title} onChange={e=>setCreating({...creating, title: e.target.value})}/>
              <input placeholder='课程封面' value={creating.cover} onChange={e=>setCreating({...creating, cover: e.target.value})}/>
              <textarea placeholder='课程描述' value={creating.description} onChange={e=>setCreating({...creating, description: e.target.value})}/>
              <textarea placeholder='课程内容' value={creating.content} onChange={e=>setCreating({...creating, content: e.target.value})}/>
              <input placeholder='价格（YD）' value={creating.price} onChange={e=>setCreating({...creating, price: e.target.value})}/>
              <button onClick={createCourse}>创建课程</button>
            </div>
          </div>

          <div style={card}>
            <h4>个人中心（签名改名）</h4>
            <p>当前昵称：{signedName || '未设置'}</p>
            <div style={{display:'flex', gap:8}}>
              <input placeholder='新昵称' value={name} onChange={e=>setName(e.target.value)} />
              <button onClick={signName}>签名保存</button>
            </div>
            <p style={{opacity:.7}}>通过 MetaMask 签名将昵称保存在本地（可安全验证签名）。</p>
          </div>

          <div>
            {!isAuthenticated ? (
              <button onClick={connectWallet}>连接钱包</button>
            ) : (
              <div>
                <p>已登录地址: {address}</p>
                <p>昵称: {nickname || "未设置"}</p>
                <input
                  type="text"
                  placeholder="修改昵称"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateNickname((e.target as HTMLInputElement).value)
                  }}
                />

                <button onClick={handleLoadCourses}>查看已购买课程</button>
                <ul>
                  {purchasedCourses.map((c) => (
                    <li key={c.id}>{c.title} - {c.price} YD</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
