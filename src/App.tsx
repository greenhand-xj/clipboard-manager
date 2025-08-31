import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Channel } from "@tauri-apps/api/core";
import "./App.css";
import { listen } from "@tauri-apps/api/event";
function App() {
  const [clipboardHistory, setClipboardHistory] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  // 加载历史记录
  const loadHistory = async () => {
    try {
      const history = await invoke<string[]>("load_last_n_entries", { n: 5 });
      setClipboardHistory(history);
    } catch (error) {
      console.error("加载历史记录失败:", error);
    }
  };

  // 复制文本到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await invoke("copy", { data: text });
      setSelectedText(text);
      setTimeout(() => setSelectedText(""), 1000); // 1秒后清除选中状态
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  // 开始监控剪贴板
  const startMonitoring = async () => {
    try {
      const onEvent = new Channel<string>();
      onEvent.onmessage = (message) => {
        console.log("新的剪贴板内容:", message);
        // 重新加载历史记录
        loadHistory();
      };

      // await invoke("init_with_channel", { onEvent });
      await invoke("init_with_emit");
      listen('clipboard-updated', () => {
        loadHistory();
      })
      setIsMonitoring(true);
    } catch (error) {
      console.error("启动监控失败:", error);
    }
  };

  // 清空历史记录
  const clearHistory = async () => {
    try {
      await invoke("wipe_all");
      setClipboardHistory([]);
    } catch (error) {
      console.error("清空历史记录失败:", error);
    }
  };

  // 页面加载时获取历史记录
  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="app">
      <div className="header">
        <h1>剪贴板管理器</h1>
        <div className="controls">
          <button
            onClick={startMonitoring}
            disabled={isMonitoring}
            className={`btn ${isMonitoring ? 'btn-disabled' : 'btn-primary'}`}
          >
            {isMonitoring ? '监控中...' : '开始监控'}
          </button>
          <button onClick={loadHistory} className="btn btn-secondary">
            刷新历史
          </button>
          <button onClick={clearHistory} className="btn btn-danger">
            清空历史
          </button>
        </div>
      </div>

      <div className="content">
        <div className="history-count">
          共 {clipboardHistory.length} 条记录
        </div>

        {clipboardHistory.length === 0 ? (
          <div className="empty-state">
            <p>暂无剪贴板历史记录</p>
            <p>开始监控后，复制的内容将显示在这里</p>
          </div>
        ) : (
          <div className="history-list">
            {clipboardHistory.map((item, index) => (
              <div
                key={index}
                className={`history-item ${selectedText === item ? 'selected' : ''}`}
                onClick={() => copyToClipboard(item)}
              >
                <div className="item-index">#{clipboardHistory.length - index}</div>
                <div className="item-content">
                  {item.length > 100 ? `${item.substring(0, 100)}...` : item}
                </div>
                <div className="item-length">{item.length} 字符</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedText && (
        <div className="toast">
          已复制到剪贴板！
        </div>
      )}
    </div>
  );
}

export default App;
