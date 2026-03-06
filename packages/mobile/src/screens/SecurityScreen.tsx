import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

type TabKey = "cameras" | "timeline" | "incidents";

interface CameraItem {
  cameraId: string;
  name: string;
  location: string;
  isOnline: boolean;
  wyzeDeviceId: string;
}

interface TransactionItem {
  transactionId: string;
  timestamp: string;
  totalAmount: number;
  foodCostPercentage: number;
  lineItems: { recipeName: string; quantity: number; price: number }[];
}

interface IncidentItem {
  incidentId: string;
  type: string;
  status: string;
  title: string;
  notes: string;
  timestamp: string;
  cameraId?: string;
  transactionId?: string;
  wasteId?: string;
  createdBy: string;
}

const LOCATION_ICONS: Record<string, string> = {
  register: "💳",
  "prep-area": "🍳",
  "drive-thru": "🚗",
  storage: "📦",
  dining: "🍽",
  entrance: "🚪",
};

const INCIDENT_TYPES = [
  { key: "theft", label: "Theft", icon: "🚨" },
  { key: "waste-verification", label: "Waste Check", icon: "🔍" },
  { key: "safety", label: "Safety", icon: "⚠" },
  { key: "discrepancy", label: "Discrepancy", icon: "📊" },
  { key: "other", label: "Other", icon: "📝" },
];

export function SecurityScreen({ navigation }: { navigation: any }) {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>("cameras");
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewIncident, setShowNewIncident] = useState(false);
  const s = makeStyles(colors);

  const STATUS_COLORS: Record<string, string> = {
    open: colors.danger,
    investigating: colors.warning,
    resolved: colors.green,
    dismissed: colors.textSecondary,
  };

  const loadData = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const [camRes, incRes] = await Promise.all([
        api.listCameras(selectedStoreId),
        api.listIncidents(selectedStoreId),
      ]);
      setCameras(camRes.cameras || []);
      setIncidents(incRes.incidents || []);
    } catch (err) {
      console.error("Security data load error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadTimeline = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const res = await api.getTransactions(selectedStoreId, dayAgo.toISOString(), now.toISOString());
      setTransactions(res.transactions || []);
    } catch (err) {
      console.error("Timeline load error:", err);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    if (activeTab === "timeline") loadTimeline();
  }, [activeTab, loadTimeline]);

  if (!selectedStoreId) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={[s.emptyText, { color: colors.textSecondary }]}>Select a store from the Dashboard first</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StorePicker />

      <View style={[s.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(["cameras", "timeline", "incidents"] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, { color: colors.textSecondary }, activeTab === tab && { color: colors.primary }]}>
              {tab === "cameras" ? `Cameras (${cameras.length})` :
               tab === "timeline" ? "Timeline" :
               `Incidents (${incidents.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "cameras" && (
        <CamerasTab cameras={cameras} storeId={selectedStoreId} onRefresh={loadData} colors={colors} s={s} />
      )}

      {activeTab === "timeline" && (
        <TimelineTab
          transactions={transactions} cameras={cameras} storeId={selectedStoreId}
          navigation={navigation} colors={colors} s={s}
          onCreateIncident={() => setShowNewIncident(true)}
        />
      )}

      {activeTab === "incidents" && (
        <IncidentsTab
          incidents={incidents} cameras={cameras} storeId={selectedStoreId}
          colors={colors} s={s} STATUS_COLORS={STATUS_COLORS}
          onNewIncident={() => setShowNewIncident(false)}
        />
      )}

      <TouchableOpacity style={[s.fab, { backgroundColor: colors.danger }]} onPress={() => setShowNewIncident(true)}>
        <Text style={s.fabText}>+ Report</Text>
      </TouchableOpacity>

      <NewIncidentModal
        visible={showNewIncident} storeId={selectedStoreId} cameras={cameras}
        colors={colors} s={s}
        onClose={() => setShowNewIncident(false)}
        onCreated={() => { setShowNewIncident(false); loadData(); }}
      />
    </View>
  );
}

function CamerasTab({ cameras, storeId, onRefresh, colors, s }: {
  cameras: CameraItem[]; storeId: string; onRefresh: () => void; colors: any; s: any;
}) {
  const [addingCamera, setAddingCamera] = useState(false);
  const [newCam, setNewCam] = useState({ name: "", location: "register", wyzeDeviceId: "", wyzeDeviceMac: "" });

  const handleAddCamera = async () => {
    if (!newCam.name || !newCam.wyzeDeviceId || !newCam.wyzeDeviceMac) {
      Alert.alert("Missing Info", "Fill in all camera fields.");
      return;
    }
    try {
      await api.registerCamera(storeId, newCam);
      setAddingCamera(false);
      setNewCam({ name: "", location: "register", wyzeDeviceId: "", wyzeDeviceMac: "" });
      onRefresh();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add camera");
    }
  };

  const requestFootage = async (camera: CameraItem) => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    try {
      const result = await api.getCameraFootage(storeId, camera.cameraId, fiveMinAgo.toISOString(), now.toISOString());
      if (result.status === "camera_offline") {
        Alert.alert("Camera Offline", `${camera.name} is currently offline.`);
      } else {
        Alert.alert("Footage Requested", `Playback requested for ${camera.name}. ${result.playbackUrl ? "Stream ready." : "Processing..."}`);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to get footage");
    }
  };

  return (
    <ScrollView style={s.tabContent}>
      {cameras.length === 0 && !addingCamera ? (
        <View style={s.emptySection}>
          <Text style={[s.emptySectionTitle, { color: colors.text }]}>No Cameras Registered</Text>
          <Text style={[s.emptySectionSub, { color: colors.textSecondary }]}>Add your Wyze cameras to enable surveillance features.</Text>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => setAddingCamera(true)}>
            <Text style={s.addBtnText}>+ Add Camera</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {cameras.map((cam) => (
            <TouchableOpacity
              key={cam.cameraId}
              style={[s.cameraCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => requestFootage(cam)}
            >
              <View style={s.cameraHeader}>
                <Text style={s.cameraIcon}>{LOCATION_ICONS[cam.location] || "📷"}</Text>
                <View style={s.cameraInfo}>
                  <Text style={[s.cameraName, { color: colors.text }]}>{cam.name}</Text>
                  <Text style={[s.cameraLocation, { color: colors.textSecondary }]}>{cam.location}</Text>
                </View>
                <View style={[s.statusDot, { backgroundColor: cam.isOnline ? colors.green : colors.red }]} />
                <Text style={[s.statusLabelText, { color: colors.textSecondary }]}>{cam.isOnline ? "Online" : "Offline"}</Text>
              </View>
              <View style={s.cameraThumbnail}>
                <Text style={s.thumbnailText}>{cam.isOnline ? "Tap to view footage" : "Camera offline"}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {!addingCamera && (
            <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => setAddingCamera(true)}>
              <Text style={s.addBtnText}>+ Add Camera</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {addingCamera && (
        <View style={[s.addCameraForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.formTitle, { color: colors.text }]}>Register Wyze Camera</Text>
          <TextInput style={[s.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="Camera name (e.g. Front Register)" placeholderTextColor={colors.textSecondary} value={newCam.name} onChangeText={(t) => setNewCam({ ...newCam, name: t })} />
          <View style={s.locationPicker}>
            {Object.entries(LOCATION_ICONS).map(([loc, icon]) => (
              <TouchableOpacity
                key={loc}
                style={[s.locationBtn, { backgroundColor: colors.background, borderColor: colors.border }, newCam.location === loc && { borderColor: colors.primary }]}
                onPress={() => setNewCam({ ...newCam, location: loc })}
              >
                <Text style={s.locationIcon}>{icon}</Text>
                <Text style={[s.locationLabel, { color: colors.textSecondary }, newCam.location === loc && { color: colors.primary }]}>{loc.replace("-", " ")}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={[s.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="Wyze Device ID" placeholderTextColor={colors.textSecondary} value={newCam.wyzeDeviceId} onChangeText={(t) => setNewCam({ ...newCam, wyzeDeviceId: t })} />
          <TextInput style={[s.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="Wyze Device MAC" placeholderTextColor={colors.textSecondary} value={newCam.wyzeDeviceMac} onChangeText={(t) => setNewCam({ ...newCam, wyzeDeviceMac: t })} />
          <View style={s.formActions}>
            <TouchableOpacity style={[s.cancelBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setAddingCamera(false)}>
              <Text style={[s.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAddCamera}>
              <Text style={s.saveBtnText}>Save Camera</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

function TimelineTab({ transactions, cameras, storeId, navigation, onCreateIncident, colors, s }: {
  transactions: TransactionItem[]; cameras: CameraItem[]; storeId: string;
  navigation: any; onCreateIncident: (txn: TransactionItem) => void; colors: any; s: any;
}) {
  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatAmount = (n: number) => `$${n.toFixed(2)}`;

  if (transactions.length === 0) {
    return (
      <View style={[s.tabContent, s.centered]}>
        <Text style={[s.emptyText, { color: colors.textSecondary }]}>No transactions in the last 24 hours</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.transactionId}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }}
      renderItem={({ item }) => {
        const highCost = item.foodCostPercentage > 35;
        return (
          <TouchableOpacity
            style={s.timelineCard}
            onPress={() => navigation.navigate("TransactionDetail", { transaction: item, storeId, cameras })}
          >
            <View style={s.timelineDot}>
              <View style={[s.dot, { backgroundColor: highCost ? colors.danger : colors.primary }]} />
              <View style={[s.timelineLine, { backgroundColor: colors.border }]} />
            </View>
            <View style={[s.timelineContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.timelineHeader}>
                <Text style={[s.timelineTime, { color: colors.text }]}>{formatTime(item.timestamp)}</Text>
                <Text style={[s.timelineAmount, { color: highCost ? colors.danger : colors.text }]}>{formatAmount(item.totalAmount)}</Text>
              </View>
              <Text style={[s.timelineItems, { color: colors.textSecondary }]}>
                {item.lineItems.map((li) => `${li.quantity}x ${li.recipeName}`).join(", ")}
              </Text>
              <View style={s.timelineFooter}>
                <Text style={[s.foodCostBadge, { color: colors.textSecondary, backgroundColor: colors.background }, highCost && { backgroundColor: colors.danger + "20", color: colors.danger }]}>
                  {item.foodCostPercentage.toFixed(1)}% food cost
                </Text>
                <TouchableOpacity style={s.flagBtn} onPress={() => onCreateIncident(item)}>
                  <Text style={s.flagText}>🚩 Flag</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

function IncidentsTab({ incidents, cameras, storeId, onNewIncident, colors, s, STATUS_COLORS }: {
  incidents: IncidentItem[]; cameras: CameraItem[]; storeId: string;
  onNewIncident: () => void; colors: any; s: any; STATUS_COLORS: Record<string, string>;
}) {
  const [filter, setFilter] = useState<string>("all");
  const filtered = filter === "all" ? incidents : incidents.filter((i) => i.status === filter);
  const getCameraName = (cameraId?: string) => cameraId ? cameras.find((c) => c.cameraId === cameraId)?.name || "Unknown Camera" : null;
  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };
  const typeIcon = (type: string) => INCIDENT_TYPES.find((t) => t.key === type)?.icon || "📝";

  return (
    <View style={s.tabContent}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
        {["all", "open", "investigating", "resolved", "dismissed"].map((st) => (
          <TouchableOpacity
            key={st}
            style={[s.filterBtn, { backgroundColor: colors.surface, borderColor: colors.border }, filter === st && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => setFilter(st)}
          >
            <Text style={[s.filterText, { color: colors.textSecondary }, filter === st && { color: "#fff" }]}>
              {st.charAt(0).toUpperCase() + st.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={s.emptySection}>
          <Text style={[s.emptySectionTitle, { color: colors.text }]}>No Incidents</Text>
          <Text style={[s.emptySectionSub, { color: colors.textSecondary }]}>
            {filter === "all" ? "No incidents reported yet." : `No ${filter} incidents.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.incidentId}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => (
            <View style={[s.incidentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.incidentHeader}>
                <Text style={s.incidentIcon}>{typeIcon(item.type)}</Text>
                <View style={s.incidentInfo}>
                  <Text style={[s.incidentTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[s.incidentDate, { color: colors.textSecondary }]}>{formatDate(item.timestamp)}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || colors.textSecondary }]}>
                  <Text style={s.statusBadgeText}>{item.status}</Text>
                </View>
              </View>
              {item.notes ? <Text style={[s.incidentNotes, { color: colors.textSecondary }]}>{item.notes}</Text> : null}
              <View style={s.incidentMeta}>
                {item.cameraId && <Text style={[s.metaTag, { color: colors.textSecondary, backgroundColor: colors.background }]}>📷 {getCameraName(item.cameraId)}</Text>}
                {item.transactionId && <Text style={[s.metaTag, { color: colors.textSecondary, backgroundColor: colors.background }]}>💳 Transaction linked</Text>}
                {item.wasteId && <Text style={[s.metaTag, { color: colors.textSecondary, backgroundColor: colors.background }]}>🗑 Waste log linked</Text>}
                <Text style={[s.metaTag, { color: colors.textSecondary, backgroundColor: colors.background }]}>By: {item.createdBy}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function NewIncidentModal({ visible, storeId, cameras, onClose, onCreated, colors, s }: {
  visible: boolean; storeId: string; cameras: CameraItem[];
  onClose: () => void; onCreated: () => void; colors: any; s: any;
}) {
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCamera, setSelectedCamera] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!type || !title) { Alert.alert("Missing Info", "Select a type and add a title."); return; }
    setSubmitting(true);
    try {
      await api.createIncident(storeId, { type, title, notes, timestamp: new Date().toISOString(), cameraId: selectedCamera || undefined });
      setType(""); setTitle(""); setNotes(""); setSelectedCamera("");
      onCreated();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create incident");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.modalOverlay}>
        <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Report Incident</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[s.modalClose, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView>
            <Text style={[s.formLabel, { color: colors.text }]}>Type</Text>
            <View style={s.typeGrid}>
              {INCIDENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[s.typeBtn, { backgroundColor: colors.background, borderColor: colors.border }, type === t.key && { borderColor: colors.primary }]}
                  onPress={() => setType(t.key)}
                >
                  <Text style={s.typeIcon}>{t.icon}</Text>
                  <Text style={[s.typeLabel, { color: colors.textSecondary }, type === t.key && { color: colors.primary }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.formLabel, { color: colors.text }]}>Title</Text>
            <TextInput style={[s.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="Brief description..." placeholderTextColor={colors.textSecondary} value={title} onChangeText={setTitle} />

            <Text style={[s.formLabel, { color: colors.text }]}>Notes</Text>
            <TextInput style={[s.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, minHeight: 80, textAlignVertical: "top" }]} placeholder="Details..." placeholderTextColor={colors.textSecondary} value={notes} onChangeText={setNotes} multiline />

            {cameras.length > 0 && (
              <>
                <Text style={[s.formLabel, { color: colors.text }]}>Link Camera (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {cameras.map((cam) => (
                    <TouchableOpacity
                      key={cam.cameraId}
                      style={[s.camChip, { backgroundColor: colors.background, borderColor: colors.border }, selectedCamera === cam.cameraId && { borderColor: colors.primary }]}
                      onPress={() => setSelectedCamera(selectedCamera === cam.cameraId ? "" : cam.cameraId)}
                    >
                      <Text style={[s.camChipText, { color: colors.text }]}>{LOCATION_ICONS[cam.location] || "📷"} {cam.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: colors.danger }, submitting && s.submitDisabled]}
              onPress={handleSubmit} disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Create Incident</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
    emptyText: { fontSize: fontSize.md, textAlign: "center" },
    tabBar: { flexDirection: "row", borderBottomWidth: 1 },
    tab: { flex: 1, paddingVertical: spacing.md, alignItems: "center" },
    tabText: { fontSize: fontSize.sm, fontWeight: "600" },
    tabContent: { flex: 1 },
    cameraCard: { margin: spacing.md, marginBottom: 0, borderRadius: 12, overflow: "hidden", borderWidth: 1 },
    cameraHeader: { flexDirection: "row", alignItems: "center", padding: spacing.md },
    cameraIcon: { fontSize: 28, marginRight: spacing.sm },
    cameraInfo: { flex: 1 },
    cameraName: { fontSize: fontSize.md, fontWeight: "700" },
    cameraLocation: { fontSize: fontSize.sm, textTransform: "capitalize" },
    statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.xs },
    statusLabelText: { fontSize: fontSize.xs },
    cameraThumbnail: { backgroundColor: colors.text + "15", height: 120, justifyContent: "center", alignItems: "center" },
    thumbnailText: { color: "rgba(255,255,255,0.6)", fontSize: fontSize.sm },
    emptySection: { alignItems: "center", padding: spacing.xl, marginTop: spacing.xl },
    emptySectionTitle: { fontSize: fontSize.lg, fontWeight: "700", marginBottom: spacing.xs },
    emptySectionSub: { fontSize: fontSize.sm, textAlign: "center", marginBottom: spacing.lg },
    addBtn: { margin: spacing.md, padding: spacing.md, borderRadius: 10, alignItems: "center" },
    addBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.md },
    addCameraForm: { margin: spacing.md, padding: spacing.lg, borderRadius: 12, borderWidth: 1 },
    formTitle: { fontSize: fontSize.lg, fontWeight: "700", marginBottom: spacing.md },
    formInput: { borderRadius: 10, padding: spacing.md, fontSize: fontSize.md, borderWidth: 1, marginBottom: spacing.sm },
    formLabel: { fontSize: fontSize.sm, fontWeight: "600", marginTop: spacing.md, marginBottom: spacing.sm },
    locationPicker: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
    locationBtn: { borderRadius: 8, padding: spacing.sm, alignItems: "center", width: "30%", borderWidth: 1 },
    locationIcon: { fontSize: 20 },
    locationLabel: { fontSize: fontSize.xs, textTransform: "capitalize", marginTop: 2 },
    formActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    cancelBtn: { flex: 1, padding: spacing.md, borderRadius: 10, alignItems: "center", borderWidth: 1 },
    cancelBtnText: { fontWeight: "600" },
    saveBtn: { flex: 1, padding: spacing.md, borderRadius: 10, alignItems: "center" },
    saveBtnText: { color: "#fff", fontWeight: "700" },
    timelineCard: { flexDirection: "row", marginBottom: spacing.sm },
    timelineDot: { width: 24, alignItems: "center", marginRight: spacing.sm },
    dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
    timelineLine: { width: 2, flex: 1, marginTop: 4 },
    timelineContent: { flex: 1, borderRadius: 10, padding: spacing.md, borderWidth: 1 },
    timelineHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
    timelineTime: { fontSize: fontSize.sm, fontWeight: "700" },
    timelineAmount: { fontSize: fontSize.md, fontWeight: "700" },
    timelineItems: { fontSize: fontSize.sm, marginBottom: spacing.sm },
    timelineFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    foodCostBadge: { fontSize: fontSize.xs, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    flagBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    flagText: { fontSize: fontSize.sm },
    filterRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    filterBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, marginRight: spacing.xs },
    filterText: { fontSize: fontSize.sm },
    incidentCard: { marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 12, padding: spacing.md, borderWidth: 1 },
    incidentHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
    incidentIcon: { fontSize: 24, marginRight: spacing.sm },
    incidentInfo: { flex: 1 },
    incidentTitle: { fontSize: fontSize.md, fontWeight: "700" },
    incidentDate: { fontSize: fontSize.xs },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    statusBadgeText: { fontSize: fontSize.xs, color: "#fff", fontWeight: "700", textTransform: "capitalize" },
    incidentNotes: { fontSize: fontSize.sm, marginBottom: spacing.sm },
    incidentMeta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    metaTag: { fontSize: fontSize.xs, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    fab: { position: "absolute", bottom: 20, right: 20, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 25, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
    fabText: { color: "#fff", fontWeight: "700", fontSize: fontSize.md },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", padding: spacing.lg },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
    modalTitle: { fontSize: fontSize.xl, fontWeight: "800" },
    modalClose: { fontSize: fontSize.xl, padding: spacing.sm },
    typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    typeBtn: { borderRadius: 10, padding: spacing.sm, alignItems: "center", width: "30%", borderWidth: 1 },
    typeIcon: { fontSize: 24, marginBottom: 2 },
    typeLabel: { fontSize: fontSize.xs, fontWeight: "600" },
    camChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, marginRight: spacing.xs, borderWidth: 1 },
    camChipText: { fontSize: fontSize.sm },
    submitBtn: { padding: spacing.md, borderRadius: 12, alignItems: "center", marginTop: spacing.lg, marginBottom: spacing.xl },
    submitDisabled: { opacity: 0.5 },
    submitText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
  });
