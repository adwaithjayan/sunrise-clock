"use client";
import { useState } from "react";

export default function OtaPanel({ ip }: { ip: string }) {
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualProgress, setManualProgress] = useState(0);
  const [manualStatus, setManualStatus] = useState("");

  const [githubInfo, setGithubInfo] = useState<{
    current: string;
    latest: string;
    update: boolean;
    url: string;
  } | null>(null);
  const [githubStatus, setGithubStatus] = useState("");

  async function uploadManual() {
    if (!manualFile) return;
    setManualStatus("Uploading…");
    const form = new FormData();
    form.append("firmware", manualFile);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        setManualProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setManualStatus(xhr.status === 200 ? "Done! Clock rebooting…" : "Failed");
    };
    xhr.open("POST", `http://${ip}/ota/upload`);
    xhr.send(form);
  }

  async function checkGithub() {
    setGithubStatus("Checking…");
    const res = await fetch(`http://${ip}/ota/check`);
    const data = await res.json();
    setGithubInfo(data);
    setGithubStatus(data.update ? "Update available!" : "Already up to date");
  }

  async function updateFromGithub() {
    if (!githubInfo?.url) return;
    setGithubStatus("Flashing from GitHub…");
    await fetch(`http://${ip}/ota/github`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: githubInfo.url }),
    });
    setGithubStatus("Flashing started — clock will reboot");
  }

  return (
    <div className="flex flex-col gap-6 p-4 border border-gray-700 rounded-xl">
      <h2 className="text-lg font-bold text-amber-400">OTA Update</h2>

      {/* Manual upload */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm text-gray-400 uppercase tracking-wider">
          Manual — upload .bin
        </h3>
        <input
          type="file"
          accept=".bin"
          onChange={(e) => setManualFile(e.target.files?.[0] ?? null)}
          className="text-sm text-gray-300"
        />
        {manualProgress > 0 && (
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-amber-500 h-2 rounded-full transition-all"
              style={{ width: `${manualProgress}%` }}
            />
          </div>
        )}
        <button
          onClick={uploadManual}
          disabled={!manualFile}
          className="w-fit px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm disabled:opacity-40"
        >
          Upload
        </button>
        {manualStatus && <p className="text-sm text-gray-300">{manualStatus}</p>}
      </div>

      {/* GitHub OTA */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm text-gray-400 uppercase tracking-wider">
          GitHub — adwaithjayan/sunrise-clock
        </h3>
        {githubInfo && (
          <div className="text-sm text-gray-300 flex gap-4">
            <span>Current: <span className="text-white">{githubInfo.current}</span></span>
            <span>Latest: <span className="text-white">{githubInfo.latest}</span></span>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={checkGithub}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            Check for update
          </button>
          {githubInfo?.update && (
            <button
              onClick={updateFromGithub}
              className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-sm"
            >
              Update Now
            </button>
          )}
        </div>
        {githubStatus && <p className="text-sm text-gray-300">{githubStatus}</p>}
      </div>
    </div>
  );
}