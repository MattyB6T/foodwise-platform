import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { spacing } from "../utils/theme";
import { CONFIG } from "../utils/config";

const KIOSK_BG = "#0f172a";
const KIOSK_SURFACE = "#1e293b";
const KIOSK_PRIMARY = "#22c55e";
const KIOSK_BLUE = "#3b82f6";
const KIOSK_RED = "#ef4444";
const KIOSK_TEXT = "#f1f5f9";
const KIOSK_DIM = "#64748b";
const KIOSK_AMBER = "#f59e0b";

interface KioskScreenProps {
  onExitKiosk: () => void;
}

type KioskState = "pin" | "confirm_clockin" | "confirm_clockout" | "message";

interface Employee {
  staffId: string;
  staffName: string;
  clockedIn: boolean;
  activeEntry?: {
    entryId: string;
    clockInTime: string;
    breakEvents: { startTime: string; endTime: string | null }[];
    onBreak: boolean;
  };
}

async function kioskRequest(method: string, path: string, body?: any) {
  const deviceId = await AsyncStorage.getItem("kiosk_device_id");
  const apiKey = await AsyncStorage.getItem("kiosk_api_key");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-kiosk-api-key": apiKey || "",
    "x-kiosk-device-id": deviceId || "",
  };
  const res = await fetch(`${CONFIG.API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export function KioskScreen({ onExitKiosk }: KioskScreenProps) {
  const [pin, setPin] = useState("");
  const [state, setState] = useState<KioskState>("pin");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [message, setMessage] = useState("");
  const [activeCount, setActiveCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("FoodWise Kiosk");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [exitPin, setExitPin] = useState("");
  const [exitAttempts, setExitAttempts] = useState(0);
  const [exitLocked, setExitLocked] = useState(false);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      const sid = await AsyncStorage.getItem("kiosk_store_id");
      const sn = await AsyncStorage.getItem("kiosk_store_name");
      if (sid) setStoreId(sid);
      if (sn) setStoreName(sn);
    })();
  }, []);

  const loadActiveCount = useCallback(async () => {
    if (!storeId) return;
    try {
      const data = await kioskRequest("GET", `/kiosk/active?storeId=${storeId}`);
      setActiveCount(data.activeCount || 0);
    } catch (_) {}
  }, [storeId]);

  useEffect(() => {
    loadActiveCount();
    const iv = setInterval(loadActiveCount, 30000);
    return () => clearInterval(iv);
  }, [loadActiveCount]);

  const showTempMessage = (msg: string) => {
    setMessage(msg);
    setState("message");
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => {
      setState("pin");
      setPin("");
      setEmployee(null);
      setMessage("");
    }, 3000);
  };

  const capturePhoto = async (): Promise<string | null> => {
    // Photo capture: in a real deployment uses expo-camera
    // For kiosk we attempt to capture via the front camera
    try {
      if (Platform.OS === "web") return null;
      // Dynamic import to avoid crash on web
      const Camera = require("expo-camera");
      if (!Camera) return null;
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== "granted") return null;
      // In production, would use CameraView ref to take picture
      // For now, return null — photo upload handled separately
      return null;
    } catch (_) {
      return null;
    }
  };

  const captureLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      if (Platform.OS === "web") return null;
      const Location = require("expo-location");
      if (!Location) return null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: 3 });
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    } catch (_) {
      return null;
    }
  };

  const handleSubmitPin = async () => {
    if (locked || !pin || pin.length < 4) return;

    try {
      const data = await kioskRequest("POST", "/kiosk/lookup", {
        storeId,
        pin,
        deviceId: await AsyncStorage.getItem("kiosk_device_id"),
      });

      if (!data.found) {
        const next = failedAttempts + 1;
        setFailedAttempts(next);
        if (next >= 5) {
          setLocked(true);
          showTempMessage("Too many failed attempts. Locked for 60 seconds.");
          setTimeout(() => {
            setLocked(false);
            setFailedAttempts(0);
          }, 60000);
        } else {
          showTempMessage("PIN not recognized");
        }
        return;
      }

      setFailedAttempts(0);
      setEmployee(data);

      if (data.clockedIn) {
        setState("confirm_clockout");
      } else {
        setState("confirm_clockin");
      }
    } catch (err: any) {
      showTempMessage(err.message || "Connection error");
    }
  };

  const handleClockIn = async () => {
    if (!employee) return;
    try {
      const [photoKey, location] = await Promise.all([capturePhoto(), captureLocation()]);
      const data = await kioskRequest("POST", "/kiosk/clockin", {
        storeId,
        staffId: employee.staffId,
        staffName: employee.staffName,
        photoKey,
        location,
      });
      loadActiveCount();
      const time = new Date(data.clockInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      showTempMessage(`Good morning ${employee.staffName}, clocked in at ${time}`);
    } catch (err: any) {
      showTempMessage(err.message || "Failed to clock in");
    }
  };

  const handleClockOut = async () => {
    if (!employee) return;
    try {
      const location = await captureLocation();
      const data = await kioskRequest("POST", "/kiosk/clockout", {
        storeId,
        staffId: employee.staffId,
        location,
      });
      loadActiveCount();
      showTempMessage(`Goodbye ${employee.staffName}! ${data.totalHours}h worked today.`);
    } catch (err: any) {
      showTempMessage(err.message || "Failed to clock out");
    }
  };

  const handleBreak = async (action: "start" | "end") => {
    if (!employee) return;
    try {
      await kioskRequest("POST", `/kiosk/break/${action}`, {
        storeId,
        staffId: employee.staffId,
      });
      loadActiveCount();
      showTempMessage(action === "start" ? `${employee.staffName}, enjoy your break!` : `Welcome back, ${employee.staffName}!`);
    } catch (err: any) {
      showTempMessage(err.message || "Break action failed");
    }
  };

  const handleLogoTap = () => {
    const next = logoTaps + 1;
    setLogoTaps(next);
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
    logoTapTimer.current = setTimeout(() => setLogoTaps(0), 2000);
    if (next >= 5) {
      setLogoTaps(0);
      setShowExitPrompt(true);
      setExitPin("");
    }
  };

  const handleExitSubmit = async () => {
    if (exitLocked) return;
    const managerPin = await AsyncStorage.getItem("kiosk_manager_pin");
    if (exitPin === managerPin) {
      setShowExitPrompt(false);
      await AsyncStorage.removeItem("kiosk_enabled");
      onExitKiosk();
    } else {
      const next = exitAttempts + 1;
      setExitAttempts(next);
      if (next >= 3) {
        setExitLocked(true);
        Alert.alert("Locked", "Exit locked for 10 minutes due to failed attempts.");
        setTimeout(() => {
          setExitLocked(false);
          setExitAttempts(0);
        }, 600000);
      } else {
        setExitPin("");
        Alert.alert("Wrong PIN", `Incorrect manager PIN. ${3 - next} attempts remaining.`);
      }
    }
  };

  const handleDigit = (d: string) => {
    if (showExitPrompt) {
      if (exitPin.length < 6) setExitPin(exitPin + d);
    } else {
      if (pin.length < 6) setPin(pin + d);
    }
  };

  const handleClear = () => {
    if (showExitPrompt) {
      setExitPin("");
    } else {
      setPin("");
    }
  };

  const handlePinSubmit = () => {
    if (showExitPrompt) {
      handleExitSubmit();
    } else {
      handleSubmitPin();
    }
  };

  const dateStr = currentTime.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const getShiftDuration = () => {
    if (!employee?.activeEntry?.clockInTime) return "";
    const ms = currentTime.getTime() - new Date(employee.activeEntry.clockInTime).getTime();
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  };

  const currentPin = showExitPrompt ? exitPin : pin;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleLogoTap} activeOpacity={1}>
          <Text style={s.logo}>FoodWise</Text>
        </TouchableOpacity>
        <Text style={s.storeName}>{storeName}</Text>
        <Text style={s.dateText}>{dateStr}</Text>
        <Text style={s.timeText}>{timeStr}</Text>
      </View>

      {/* Main content */}
      <View style={s.content}>
        {showExitPrompt ? (
          <View style={s.promptCard}>
            <Text style={s.promptTitle}>Enter Manager PIN to Exit Kiosk</Text>
            <View style={s.pinDisplay}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={[s.pinDot, currentPin.length > i && s.pinDotFilled]} />
              ))}
            </View>
            <TouchableOpacity style={s.cancelExitBtn} onPress={() => { setShowExitPrompt(false); setExitPin(""); }}>
              <Text style={s.cancelExitText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : state === "message" ? (
          <View style={s.messageCard}>
            <Text style={s.messageText}>{message}</Text>
          </View>
        ) : state === "confirm_clockin" && employee ? (
          <View style={s.confirmCard}>
            <Text style={s.employeeName}>{employee.staffName}</Text>
            <Text style={s.confirmLabel}>Not clocked in</Text>
            <TouchableOpacity style={s.clockInBtn} onPress={handleClockIn}>
              <Text style={s.clockInBtnText}>Clock In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.backBtn} onPress={() => { setState("pin"); setPin(""); }}>
              <Text style={s.backBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : state === "confirm_clockout" && employee ? (
          <View style={s.confirmCard}>
            <Text style={s.employeeName}>{employee.staffName}</Text>
            <Text style={s.confirmLabel}>
              Clocked in since {employee.activeEntry?.clockInTime ? new Date(employee.activeEntry.clockInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            </Text>
            <Text style={s.shiftDuration}>{getShiftDuration()} on shift</Text>
            <View style={s.actionRow}>
              <TouchableOpacity style={s.clockOutBtn} onPress={handleClockOut}>
                <Text style={s.clockOutBtnText}>Clock Out</Text>
              </TouchableOpacity>
              {employee.activeEntry?.onBreak ? (
                <TouchableOpacity style={s.breakBtn} onPress={() => handleBreak("end")}>
                  <Text style={s.breakBtnText}>End Break</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[s.breakBtn, { borderColor: KIOSK_AMBER }]} onPress={() => handleBreak("start")}>
                  <Text style={[s.breakBtnText, { color: KIOSK_AMBER }]}>Start Break</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={s.backBtn} onPress={() => { setState("pin"); setPin(""); }}>
              <Text style={s.backBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.pinSection}>
            <Text style={s.pinPrompt}>{locked ? "Kiosk Locked" : "Enter your PIN"}</Text>
            <View style={s.pinDisplay}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={[s.pinDot, currentPin.length > i && s.pinDotFilled]} />
              ))}
            </View>
          </View>
        )}
      </View>

      {/* PIN Pad */}
      <View style={s.padContainer}>
        <View style={s.padRow}>
          {["1", "2", "3"].map((d) => (
            <TouchableOpacity key={d} style={s.padBtn} onPress={() => handleDigit(d)}>
              <Text style={s.padText}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.padRow}>
          {["4", "5", "6"].map((d) => (
            <TouchableOpacity key={d} style={s.padBtn} onPress={() => handleDigit(d)}>
              <Text style={s.padText}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.padRow}>
          {["7", "8", "9"].map((d) => (
            <TouchableOpacity key={d} style={s.padBtn} onPress={() => handleDigit(d)}>
              <Text style={s.padText}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.padRow}>
          <TouchableOpacity style={[s.padBtn, s.padClear]} onPress={handleClear}>
            <Text style={[s.padText, { color: KIOSK_RED }]}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.padBtn} onPress={() => handleDigit("0")}>
            <Text style={s.padText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.padBtn, s.padSubmit]} onPress={handlePinSubmit}>
            <Text style={[s.padText, { color: KIOSK_PRIMARY }]}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>{activeCount} employee{activeCount !== 1 ? "s" : ""} on shift</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: KIOSK_BG },
  header: { alignItems: "center", paddingTop: spacing.xl, paddingBottom: spacing.md },
  logo: { fontSize: 28, fontWeight: "800", color: KIOSK_PRIMARY },
  storeName: { fontSize: 16, color: KIOSK_TEXT, fontWeight: "600", marginTop: 4 },
  dateText: { fontSize: 14, color: KIOSK_DIM, marginTop: 2 },
  timeText: { fontSize: 42, fontWeight: "200", color: KIOSK_TEXT, marginTop: spacing.xs, fontVariant: ["tabular-nums"] },
  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xl },
  pinSection: { alignItems: "center" },
  pinPrompt: { fontSize: 20, color: KIOSK_DIM, marginBottom: spacing.lg },
  pinDisplay: { flexDirection: "row", gap: 12 },
  pinDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: KIOSK_DIM },
  pinDotFilled: { backgroundColor: KIOSK_PRIMARY, borderColor: KIOSK_PRIMARY },
  messageCard: { backgroundColor: KIOSK_SURFACE, borderRadius: 16, padding: spacing.xl, alignItems: "center", maxWidth: 400 },
  messageText: { fontSize: 22, color: KIOSK_TEXT, textAlign: "center", fontWeight: "600" },
  confirmCard: { backgroundColor: KIOSK_SURFACE, borderRadius: 16, padding: spacing.xl, alignItems: "center", maxWidth: 400, width: "100%" },
  employeeName: { fontSize: 28, fontWeight: "700", color: KIOSK_TEXT, marginBottom: spacing.sm },
  confirmLabel: { fontSize: 16, color: KIOSK_DIM },
  shiftDuration: { fontSize: 20, color: KIOSK_PRIMARY, fontWeight: "600", marginTop: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  clockInBtn: { backgroundColor: KIOSK_PRIMARY, paddingHorizontal: spacing.xl * 2, paddingVertical: spacing.md, borderRadius: 12, marginTop: spacing.lg },
  clockInBtnText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  clockOutBtn: { backgroundColor: KIOSK_RED, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 12 },
  clockOutBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  breakBtn: { borderWidth: 2, borderColor: KIOSK_BLUE, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 12 },
  breakBtnText: { color: KIOSK_BLUE, fontSize: 18, fontWeight: "700" },
  backBtn: { marginTop: spacing.md },
  backBtnText: { color: KIOSK_DIM, fontSize: 16 },
  padContainer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  padRow: { flexDirection: "row", justifyContent: "center", gap: spacing.md, marginBottom: spacing.sm },
  padBtn: { width: 80, height: 60, borderRadius: 12, backgroundColor: KIOSK_SURFACE, justifyContent: "center", alignItems: "center" },
  padText: { fontSize: 24, fontWeight: "600", color: KIOSK_TEXT },
  padClear: { backgroundColor: "transparent", borderWidth: 1, borderColor: KIOSK_RED + "40" },
  padSubmit: { backgroundColor: "transparent", borderWidth: 1, borderColor: KIOSK_PRIMARY + "40" },
  promptCard: { backgroundColor: KIOSK_SURFACE, borderRadius: 16, padding: spacing.xl, alignItems: "center", maxWidth: 400 },
  promptTitle: { fontSize: 18, color: KIOSK_TEXT, fontWeight: "600", marginBottom: spacing.lg },
  cancelExitBtn: { marginTop: spacing.lg },
  cancelExitText: { color: KIOSK_DIM, fontSize: 16 },
  footer: { padding: spacing.md, alignItems: "center" },
  footerText: { color: KIOSK_DIM, fontSize: 14 },
});
