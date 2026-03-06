import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";

export function TimeEntryDetailScreen() {
  const route = useRoute<any>();
  const { colors } = useTheme();
  const { staffId, staffName, storeId, week } = route.params || {};
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoEntryId, setPhotoEntryId] = useState<string | null>(null);
  const s = makeStyles(colors);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const data = await api.getTimesheetWeek(storeId, week);
      const emp = (data.employees || []).find((e: any) => e.staffId === staffId);
      setEntries(emp?.entries || []);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (entryId: string) => {
    try {
      await api.approveTimeEntry(storeId, entryId);
      Alert.alert("Approved", "Entry approved for payroll.");
      loadEntries();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleSaveEdit = async (entryId: string) => {
    if (!editReason) {
      Alert.alert("Required", "Reason for edit is required.");
      return;
    }
    try {
      await api.editTimeEntry(storeId, entryId, { reason: editReason, notes: editNotes || undefined });
      Alert.alert("Saved", "Entry updated.");
      setEditingId(null);
      setEditReason("");
      setEditNotes("");
      loadEntries();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleViewPhoto = async (entryId: string) => {
    try {
      const data = await api.getTimeEntryPhoto(storeId, entryId);
      setPhotoUrl(data.photoUrl);
      setPhotoEntryId(entryId);
    } catch (err: any) {
      Alert.alert("No Photo", err.message || "Photo not available");
    }
  };

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.background }]}>
      <View style={s.headerCard}>
        <Text style={[s.name, { color: colors.text }]}>{staffName}</Text>
        <Text style={[s.weekLabel, { color: colors.textSecondary }]}>Week of {week}</Text>
        <Text style={[s.totalHours, { color: colors.primary }]}>
          Total: {Math.round(entries.reduce((sum: number, e: any) => sum + (e.totalHours || 0), 0) * 10) / 10}h
        </Text>
      </View>

      {photoUrl && (
        <View style={[s.photoCard, { backgroundColor: colors.surface }]}>
          <Text style={[s.photoLabel, { color: colors.text }]}>Clock-in Photo</Text>
          <Image source={{ uri: photoUrl }} style={s.photo} resizeMode="cover" />
          <TouchableOpacity onPress={() => { setPhotoUrl(null); setPhotoEntryId(null); }}>
            <Text style={[s.closePhoto, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {entries.map((entry: any) => (
        <View key={entry.entryId} style={[s.entryCard, { backgroundColor: colors.surface, borderLeftColor: entry.flagged ? colors.danger : colors.secondary, borderLeftWidth: 3 }]}>
          <View style={s.entryHeader}>
            <Text style={[s.entryDate, { color: colors.text }]}>
              {entry.clockInTime?.split("T")[0]}
            </Text>
            <View style={s.badges}>
              {entry.flagged && <Text style={s.badge}>⚠️ Flagged</Text>}
              {entry.managerApproved && <Text style={[s.badge, { color: colors.secondary }]}>✓ Approved</Text>}
            </View>
          </View>

          <View style={s.timesRow}>
            <View style={s.timeCol}>
              <Text style={[s.timeLabel, { color: colors.textSecondary }]}>In</Text>
              <Text style={[s.timeValue, { color: colors.text }]}>
                {entry.clockInTime ? new Date(entry.clockInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
              </Text>
            </View>
            <View style={s.timeCol}>
              <Text style={[s.timeLabel, { color: colors.textSecondary }]}>Out</Text>
              <Text style={[s.timeValue, { color: colors.text }]}>
                {entry.clockOutTime ? new Date(entry.clockOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Active"}
              </Text>
            </View>
            <View style={s.timeCol}>
              <Text style={[s.timeLabel, { color: colors.textSecondary }]}>Hours</Text>
              <Text style={[s.timeValue, { color: colors.primary }]}>{entry.totalHours ?? "—"}</Text>
            </View>
            <View style={s.timeCol}>
              <Text style={[s.timeLabel, { color: colors.textSecondary }]}>Breaks</Text>
              <Text style={[s.timeValue, { color: colors.text }]}>{entry.totalBreakMinutes ?? 0}m</Text>
            </View>
          </View>

          {entry.flagReason && (
            <Text style={[s.flagReason, { color: colors.danger }]}>Flag: {entry.flagReason}</Text>
          )}

          {entry.notes && (
            <Text style={[s.notes, { color: colors.textSecondary }]}>Notes: {entry.notes}</Text>
          )}

          <View style={s.entryActions}>
            {entry.clockInPhotoKey && (
              <TouchableOpacity style={[s.smallBtn, { borderColor: colors.border }]} onPress={() => handleViewPhoto(entry.entryId)}>
                <Text style={[s.smallBtnText, { color: colors.primary }]}>Photo</Text>
              </TouchableOpacity>
            )}
            {!entry.managerApproved && entry.clockOutTime && (
              <TouchableOpacity style={[s.smallBtn, { borderColor: colors.secondary }]} onPress={() => handleApprove(entry.entryId)}>
                <Text style={[s.smallBtnText, { color: colors.secondary }]}>Approve</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.smallBtn, { borderColor: colors.border }]}
              onPress={() => { setEditingId(editingId === entry.entryId ? null : entry.entryId); setEditReason(""); setEditNotes(entry.notes || ""); }}
            >
              <Text style={[s.smallBtnText, { color: colors.text }]}>Edit</Text>
            </TouchableOpacity>
          </View>

          {editingId === entry.entryId && (
            <View style={s.editForm}>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Reason for edit (required)"
                placeholderTextColor={colors.textSecondary}
                value={editReason}
                onChangeText={setEditReason}
              />
              <TextInput
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Notes"
                placeholderTextColor={colors.textSecondary}
                value={editNotes}
                onChangeText={setEditNotes}
              />
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={() => handleSaveEdit(entry.entryId)}>
                <Text style={s.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      {entries.length === 0 && (
        <Text style={[s.empty, { color: colors.textSecondary }]}>No entries for this employee this week</Text>
      )}

      <View style={{ height: spacing.xl * 2 }} />
    </ScrollView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    headerCard: { padding: spacing.lg, alignItems: "center" },
    name: { fontSize: fontSize.xl, fontWeight: "700" },
    weekLabel: { fontSize: fontSize.sm, marginTop: 2 },
    totalHours: { fontSize: 32, fontWeight: "800", marginTop: spacing.sm },
    photoCard: { margin: spacing.md, borderRadius: 12, padding: spacing.md, alignItems: "center" },
    photoLabel: { fontSize: fontSize.sm, fontWeight: "600", marginBottom: spacing.sm },
    photo: { width: 200, height: 200, borderRadius: 10 },
    closePhoto: { marginTop: spacing.sm, fontWeight: "600" },
    entryCard: { margin: spacing.md, marginTop: 0, borderRadius: 10, padding: spacing.md },
    entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
    entryDate: { fontSize: fontSize.md, fontWeight: "600" },
    badges: { flexDirection: "row", gap: spacing.sm },
    badge: { fontSize: fontSize.xs, fontWeight: "600" },
    timesRow: { flexDirection: "row", justifyContent: "space-between" },
    timeCol: { alignItems: "center" },
    timeLabel: { fontSize: fontSize.xs },
    timeValue: { fontSize: fontSize.md, fontWeight: "700" },
    flagReason: { fontSize: fontSize.xs, marginTop: spacing.sm, fontStyle: "italic" },
    notes: { fontSize: fontSize.xs, marginTop: spacing.xs },
    entryActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    smallBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 6, borderWidth: 1 },
    smallBtnText: { fontSize: fontSize.xs, fontWeight: "600" },
    editForm: { marginTop: spacing.md },
    input: { borderRadius: 8, padding: spacing.sm, fontSize: fontSize.sm, borderWidth: 1, marginBottom: spacing.sm },
    saveBtn: { padding: spacing.sm, borderRadius: 8, alignItems: "center" },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.sm },
    empty: { textAlign: "center", padding: spacing.xl },
  });
