import { useState, useEffect, useCallback } from "react"
import { ethers } from "ethers"

const API_BASE = "http://localhost:3001" // 后端地址

export function useAuth() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)
  const [address, setAddress] = useState<string>("")
  const [nickname, setNickname] = useState<string>("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // 连接钱包
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert("请安装 MetaMask")
      return
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
    setProvider(provider)
    const signer = await provider.getSigner()
    setSigner(signer)
    const addr = await signer.getAddress()
    setAddress(addr)

    // 调用后端检查该地址是否已注册
    const resp = await fetch(`${API_BASE}/user/check?address=${addr}`)
    const data = await resp.json()

    if (data.exists) {
      // 已注册，直接登录
      setNickname(data.nickname || "")
      setIsAuthenticated(true)
      return
    }

    // 未注册：第一次登录，需要签名
    const message = `web3-university-login-${addr}`
    const signature = await signer.signMessage(message)

    const res = await fetch(`${API_BASE}/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: addr, signature, nickname: "" }),
    })

    if (res.ok) {
      setIsAuthenticated(true)
    }
  }, [])

  // 修改昵称
  const updateNickname = useCallback(async (newName: string) => {
    if (!address) return
    const res = await fetch(`${API_BASE}/user/update-nickname`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, nickname: newName }),
    })
    if (res.ok) {
      setNickname(newName)
    }
  }, [address])

  // 获取已购买课程
  const getPurchasedCourses = useCallback(async () => {
    if (!address) return []
    const res = await fetch(`${API_BASE}/courses?address=${address}&mode=mine`)
    if (!res.ok) return []
    return await res.json()
  }, [address])

  return {
    provider,
    signer,
    address,
    nickname,
    isAuthenticated,
    connectWallet,
    updateNickname,
    getPurchasedCourses
  }
}
