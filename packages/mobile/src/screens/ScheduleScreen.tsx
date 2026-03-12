import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Share,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

interface Shift {
  shiftId: string;
  staffId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  position: string | null;
}

interface StaffMember {
  staffId: string;
  name: string;
  role: string;
  active?: boolean;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

export function ScheduleScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaffIdx, setSelectedStaffIdx] = useState(0);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [position, setPosition] = useState("");
  const [saving, setSaving] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dateStr = addDays(weekStart, i);
    const d = new Date(dateStr);
    return { dateStr, dayName: DAY_NAMES[d.getDay()], dayNum: d.getDate() };
  });

  const weekLabel = new Date(weekStart).toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const loadData = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const [schedResult, staffResult] = await Promise.all([
        api.getSchedule(selectedStoreId, weekStart),
        api.listStaff(selectedStoreId),
      ]);
      setShifts(schedResult.shifts || []);
      const active = (staffResult.staff || []).filter((s: StaffMember) => s.active !== false);
      setStaff(active);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, weekStart]);

  useEffect(() => { loadData(); }, [loadData]);

  // Group shifts by date for display
  const shiftsByDate: Record<string, Shift[]> = {};
  for (const shift of shifts) {
    if (!shiftsByDate[shift.date]) shiftsByDate[shift.date] = [];
    shiftsByDate[shift.date].push(shift);
  }

  const handleAddShift = async () => {
    if (!selectedStoreId || staff.length === 0) return;
    const member = staff[selectedStaffIdx];
    const day = weekDays[selectedDayIdx];
    if (!startTime || !endTime) {
      Alert.alert("Error", "Start and end times are required");
      return;
    }
    setSaving(true);
    try {
      await api.createShift(selectedStoreId, {
        staffId: member.staffId,
        staffName: member.name,
        date: day.dateStr,
        startTime,
        endTime,
        position: position || undefined,
      });
      setShowAddModal(false);
      setPosition("");
      setStartTime("09:00");
      setEndTime("17:00");
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add shift");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = (shift: Shift) => {
    Alert.alert(
      "Delete Shift",
      `Remove ${shift.staffName}'s shift on ${shift.date} (${shift.startTime}–${shift.endTime})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteShift(selectedStoreId!, shift.shiftId);
              loadData();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete shift");
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    let text = `Schedule — Week of ${weekLabel}\n${"─".repeat(30)}\n\n`;
    const staffMap: Record<string, { name: string; role: string; shifts: { day: string; time: string }[] }> = {};

    for (const member of staff) {
      staffMap[member.staffId] = { name: member.name, role: member.role, shifts: [] };
    }

    for (const shift of shifts) {
      const d = new Date(shift.date);
      const dayName = DAY_NAMES[d.getDay()];
      const dayNum = d.getDate();
      const entry = { day: `${dayName} ${dayNum}`, time: `${shift.startTime}–${shift.endTime}${shift.position ? ` (${shift.position})` : ""}` };
      if (staffMap[shift.staffId]) {
        staffMap[shift.staffId].shifts.push(entry);
      } else {
        staffMap[shift.staffId] = { name: shift.staffName, role: "", shifts: [entry] };
      }
    }

    for (const member of Object.values(staffMap)) {
      text += `${member.name}${member.role ? ` (${member.role})` : ""}\n`;
      if (member.shifts.length > 0) {
        for (const s of member.shifts) {
          text += `  ${s.day}: ${s.time}\n`;
        }
      } else {
        text += "  No shifts this week\n";
      }
      text += "\n";
    }

    try {
      await Share.share({
        message: text.trim(),
        ...(Platform.OS === "ios" ? { title: `Schedule — Week of ${weekLabel}` } : {}),
      });
    } catch (_) {
      // user cancelled share
    }
  };

  if (!selectedStoreId) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center" }}>
          Select a store from the Dashboard first
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StorePicker />

      {/* Week Navigation */}
      <View style={s.weekNav}>
        <TouchableOpacity onPress={() => setWeekStart(addDays(weekStart, -7))} style={[s.navBtn, { backgroundColor: colors.surface }]}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.weekLabel, { color: colors.text }]}>Week of {weekLabel}</Text>
        <TouchableOpacity onPress={() => setWeekStart(addDays(weekStart, 7))} style={[s.navBtn, { backgroundColor: colors.surface }]}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={s.actionRow}>
        <TouchableOpacity
          onPress={() => {
            setSelectedStaffIdx(0);
            setSelectedDayIdx(0);
            setShowAddModal(true);
          }}
          disabled={staff.length === 0}
          style={[s.addBtn, { backgroundColor: colors.primary, opacity: staff.length === 0 ? 0.5 : 1 }]}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.addBtnText}>Add Shift</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleShare}
          disabled={shifts.length === 0}
          style={[s.shareBtn, { backgroundColor: colors.surface, opacity: shifts.length === 0 ? 0.5 : 1 }]}
        >
          <Ionicons name="share-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Schedule List */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : (
        <FlatList
          data={weekDays}
          keyExtractor={(item) => item.dateStr}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl }}
          renderItem={({ item: day }) => {
            const dayShifts = shiftsByDate[day.dateStr] || [];
            return (
              <View style={{ marginBottom: spacing.sm }}>
                <Text style={[s.dayHeader, { color: colors.textSecondary }]}>
                  {day.dayName} {day.dayNum}
                </Text>
                {dayShifts.length > 0 ? (
                  dayShifts.map((shift) => (
                    <TouchableOpacity
                      key={shift.shiftId}
                      onLongPress={() => handleDeleteShift(shift)}
                      style={[s.shiftCard, { backgroundColor: colors.surface }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.shiftName, { color: colors.text }]}>{shift.staffName}</Text>
                        <Text style={[s.shiftTime, { color: colors.textSecondary }]}>
                          {shift.startTime} – {shift.endTime}
                        </Text>
                        {shift.position && (
                          <Text style={[s.positionTag, { color: colors.primary }]}>{shift.position}</Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteShift(shift)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={[s.noShifts, { color: colors.textSecondary }]}>No shifts</Text>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Add Shift Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Add Shift</Text>

            {/* Staff Picker */}
            <Text style={[s.label, { color: colors.textSecondary }]}>Staff Member</Text>
            <View style={s.chipRow}>
              {staff.map((member, idx) => (
                <TouchableOpacity
                  key={member.staffId}
                  onPress={() => setSelectedStaffIdx(idx)}
                  style={[
                    s.chip,
                    { backgroundColor: idx === selectedStaffIdx ? colors.primary : colors.background,
                      borderColor: idx === selectedStaffIdx ? colors.primary : colors.textSecondary + "30" },
                  ]}
                >
                  <Text style={{ color: idx === selectedStaffIdx ? "#fff" : colors.text, fontSize: fontSize.xs, fontWeight: "600" }}>
                    {member.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Day Picker */}
            <Text style={[s.label, { color: colors.textSecondary, marginTop: spacing.md }]}>Day</Text>
            <View style={s.chipRow}>
              {weekDays.map((day, idx) => (
                <TouchableOpacity
                  key={day.dateStr}
                  onPress={() => setSelectedDayIdx(idx)}
                  style={[
                    s.chip,
                    { backgroundColor: idx === selectedDayIdx ? colors.primary : colors.background,
                      borderColor: idx === selectedDayIdx ? colors.primary : colors.textSecondary + "30" },
                  ]}
                >
                  <Text style={{ color: idx === selectedDayIdx ? "#fff" : colors.text, fontSize: fontSize.xs, fontWeight: "600" }}>
                    {day.dayName} {day.dayNum}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Time Inputs */}
            <View style={[s.timeRow, { marginTop: spacing.md }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.textSecondary }]}>Start Time</Text>
                <TextInput
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="09:00"
                  placeholderTextColor={colors.textSecondary}
                  style={[s.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary + "30" }]}
                />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[s.label, { color: colors.textSecondary }]}>End Time</Text>
                <TextInput
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="17:00"
                  placeholderTextColor={colors.textSecondary}
                  style={[s.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary + "30" }]}
                />
              </View>
            </View>

            {/* Position */}
            <Text style={[s.label, { color: colors.textSecondary, marginTop: spacing.md }]}>Position (optional)</Text>
            <TextInput
              value={position}
              onChangeText={setPosition}
              placeholder="e.g. Cashier, Line Cook"
              placeholderTextColor={colors.textSecondary}
              style={[s.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary + "30" }]}
            />

            {/* Buttons */}
            <View style={[s.modalButtons, { marginTop: spacing.lg }]}>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={s.cancelBtn}>
                <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: fontSize.sm }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddShift}
                disabled={saving || staff.length === 0}
                style={[s.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: fontSize.sm }}>
                  {saving ? "Adding..." : "Add Shift"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
    weekNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    navBtn: { padding: spacing.sm, borderRadius: 8 },
    weekLabel: { fontSize: fontSize.md, fontWeight: "700" },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      gap: 4,
    },
    addBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.sm },
    shareBtn: {
      padding: spacing.sm,
      borderRadius: 8,
    },
    dayHeader: {
      fontSize: fontSize.xs,
      fontWeight: "700",
      textTransform: "uppercase",
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.sm,
      paddingBottom: 4,
    },
    shiftCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      padding: spacing.md,
      marginBottom: 4,
    },
    shiftName: { fontSize: fontSize.sm, fontWeight: "600" },
    shiftTime: { fontSize: fontSize.xs, marginTop: 2 },
    positionTag: { fontSize: fontSize.xs, fontWeight: "600", marginTop: 2 },
    noShifts: { fontSize: fontSize.xs, paddingHorizontal: spacing.sm, paddingBottom: spacing.xs },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    modalContent: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: spacing.lg,
      maxHeight: "85%",
    },
    modalTitle: { fontSize: fontSize.lg, fontWeight: "700", marginBottom: spacing.md },
    label: { fontSize: fontSize.xs, fontWeight: "600", marginBottom: 4, textTransform: "uppercase" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
    },
    timeRow: { flexDirection: "row" },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.sm,
    },
    modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
    cancelBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    saveBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 8 },
  });
