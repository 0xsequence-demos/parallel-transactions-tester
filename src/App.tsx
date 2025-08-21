import { useMemo, useState } from 'react'
import './App.css'
import { Session } from '@0xsequence/auth'
import { ethers } from 'ethers'
import { allNetworks } from '@0xsequence/network'

//

type TxResult = {
  index: number
  startedAtMs: number
  endedAtMs?: number
  durationMs?: number
  hash?: string
  error?: string
}

// Using networks provided by @0xsequence/network below

function App() {
  const availableNetworks = useMemo(() => allNetworks.filter((n) => !n.disabled), [])
  const defaultChainId = useMemo(() => availableNetworks.find((n) => n.isDefaultChain)?.chainId || availableNetworks[0]?.chainId || 1, [availableNetworks])
  const [selectedChainId, setSelectedChainId] = useState<number>(defaultChainId)
  const [targetAddress, setTargetAddress] = useState<string>('')
  const [txCount, setTxCount] = useState<number>(5)
  const [customRpcUrl, setCustomRpcUrl] = useState<string>('')
  const [projectAccessKeyInput, setProjectAccessKeyInput] = useState<string>('')
  const [privateKeyInput, setPrivateKeyInput] = useState<string>('')
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false)

  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [results, setResults] = useState<TxResult[]>([])
  const [errorMessage, setErrorMessage] = useState<string>('')

  const defaults = useMemo(() => {
    const pak = import.meta.env.VITE_SEQUENCE_PROJECT_ACCESS_KEY as string | undefined
    const pk = import.meta.env.VITE_TEST_PRIVATE_KEY as string | undefined
    const rpc = import.meta.env.VITE_DEFAULT_RPC_URL as string | undefined
    return { pak, pk, rpc }
  }, [])

  const selectedNetwork = useMemo(() => {
    return availableNetworks.find((n) => n.chainId === selectedChainId) || availableNetworks[0]
  }, [availableNetworks, selectedChainId])

  const explorerLinkFor = (hash?: string) => {
    if (!hash) return ''
    const be = selectedNetwork?.blockExplorer
    if (!be) return ''
    const root = (be.rootUrl || '').replace(/\/$/, '')
    const txnBase = (be as any).txnHashUrl ? (be as any).txnHashUrl.replace(/\/$/, '') : `${root}/tx`
    return `${txnBase}/${hash}`
  }

  async function runTransactionsParallel() {
    setIsRunning(true)
    setResults([])
    setErrorMessage('')

    try {
      if (!ethers.isAddress(targetAddress)) {
        throw new Error('Invalid target address')
      }
      if (!Number.isFinite(txCount) || txCount <= 0) {
        throw new Error('Transaction count must be a positive number')
      }

      const rpcUrl = customRpcUrl || selectedNetwork.rpcUrl
      const projectAccessKey = projectAccessKeyInput || defaults.pak
      const privateKey = privateKeyInput || defaults.pk

      if (!projectAccessKey) {
        throw new Error('Missing project access key. Set VITE_SEQUENCE_PROJECT_ACCESS_KEY or use Advanced.')
      }
      if (!privateKey) {
        throw new Error('Missing private key. Set VITE_TEST_PRIVATE_KEY or use Advanced.')
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl, selectedChainId)
      const eoa = new ethers.Wallet(privateKey, provider)

      const session = await Session.singleSigner({
        signer: eoa,
        projectAccessKey
      })

      const sequenceSigner = session.account.getSigner(selectedChainId)

      const tasks = Array.from({ length: txCount }, (_, i) => i)

      await Promise.allSettled(
        tasks.map(async (i) => {
          const startedAtMs = Date.now()
          setResults((prev) => [...prev, { index: i, startedAtMs }])
          try {
            const tx = await sequenceSigner.sendTransaction({
              to: targetAddress,
              data: '0x',
              value: 0n
            })

            // ethers v6 TransactionResponse has wait()
            const receipt = await tx.wait()
            const endedAtMs = Date.now()
            const durationMs = endedAtMs - startedAtMs
            const hash = receipt?.hash || tx.hash

            setResults((prev) =>
              prev
                .map((r) => (r.index === i ? { ...r, endedAtMs, durationMs, hash } : r))
                .sort((a, b) => a.index - b.index)
            )
          } catch (err: unknown) {
            const endedAtMs = Date.now()
            const durationMs = endedAtMs - startedAtMs
            const error = err instanceof Error ? err.message : String(err)
            setResults((prev) =>
              prev
                .map((r) => (r.index === i ? { ...r, endedAtMs, durationMs, error } : r))
                .sort((a, b) => a.index - b.index)
            )
          }
        })
      )
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1>Parallel Transaction Tester</h1>
      <p style={{ marginTop: -8 }}>
        Uses Sequence session auth to relay N parallel transactions to a target address.
      </p>

      <div className='card' style={{ display: 'grid', gap: 12 }}>
        <label>
          <span>Network</span>
          <select
            value={selectedChainId}
            onChange={(e) => setSelectedChainId(Number(e.target.value))}
            disabled={isRunning}
            style={{ display: 'block', marginTop: 6 }}
          >
            {availableNetworks.map((n) => (
              <option key={n.chainId} value={n.chainId}>
                {(n.title || n.name)} (chainId {n.chainId})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Target wallet address</span>
          <input
            type='text'
            placeholder='0x...'
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
            disabled={isRunning}
            style={{ width: '100%', marginTop: 6 }}
          />
        </label>

        <label>
          <span>Number of transactions</span>
          <input
            type='number'
            min={1}
            step={1}
            value={txCount}
            onChange={(e) => setTxCount(Number(e.target.value))}
            disabled={isRunning}
            style={{ width: '100%', marginTop: 6 }}
          />
        </label>

        <button onClick={() => setShowAdvanced((s) => !s)} disabled={isRunning}>
          {showAdvanced ? 'Hide advanced' : 'Show advanced'}
        </button>

        {showAdvanced && (
          <div style={{ display: 'grid', gap: 12, padding: 12, border: '1px solid #444', borderRadius: 8 }}>
            <label>
              <span>RPC URL (optional)</span>
              <input
                type='text'
                placeholder={selectedNetwork.rpcUrl}
                value={customRpcUrl}
                onChange={(e) => setCustomRpcUrl(e.target.value)}
                disabled={isRunning}
                style={{ width: '100%', marginTop: 6 }}
              />
            </label>
            <label>
              <span>Project Access Key</span>
              <input
                type='password'
                placeholder='VITE_SEQUENCE_PROJECT_ACCESS_KEY or enter here'
                value={projectAccessKeyInput}
                onChange={(e) => setProjectAccessKeyInput(e.target.value)}
                disabled={isRunning}
                style={{ width: '100%', marginTop: 6 }}
              />
            </label>
            <label>
              <span>Private Key (EOA)</span>
              <input
                type='password'
                placeholder='VITE_TEST_PRIVATE_KEY or enter here'
                value={privateKeyInput}
                onChange={(e) => setPrivateKeyInput(e.target.value)}
                disabled={isRunning}
                style={{ width: '100%', marginTop: 6 }}
              />
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={runTransactionsParallel} disabled={isRunning}>
            {isRunning ? 'Running…' : 'Run transactions'}
          </button>
          <button onClick={() => setResults([])} disabled={isRunning}>Clear results</button>
        </div>
        {errorMessage && (
          <div style={{ color: 'tomato' }}>{errorMessage}</div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <h2>Results</h2>
        {results.length === 0 ? (
          <p>No results yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #444', padding: 8 }}>#</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #444', padding: 8 }}>Started</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #444', padding: 8 }}>Ended</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #444', padding: 8 }}>Duration (ms)</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #444', padding: 8 }}>Hash</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #444', padding: 8 }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {results
                  .sort((a, b) => a.index - b.index)
                  .map((r) => (
                    <tr key={r.index}>
                      <td style={{ padding: 8 }}>{r.index + 1}</td>
                      <td style={{ padding: 8 }}>{new Date(r.startedAtMs).toLocaleTimeString()}</td>
                      <td style={{ padding: 8 }}>{r.endedAtMs ? new Date(r.endedAtMs).toLocaleTimeString() : '-'}</td>
                      <td style={{ padding: 8 }}>{r.durationMs ?? '-'}</td>
                      <td style={{ padding: 8 }}>
                        {r.hash ? (
                          <a href={explorerLinkFor(r.hash)} target='_blank' rel='noreferrer'>
                            {r.hash}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: 8, color: r.error ? 'tomato' : undefined }}>{r.error ?? '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p style={{ marginTop: 24, fontSize: 12, opacity: 0.8 }}>
        Parallel send approach adapted from sample implementation in <a href='https://github.com/0xsequence/tps-reporter/blob/main/src/index.ts' target='_blank' rel='noreferrer'>tps-reporter</a>.
      </p>
    </div>
  )
}

export default App
