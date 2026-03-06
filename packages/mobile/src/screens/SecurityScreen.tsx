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
import { api } from "../utils/api";
import { colors, fontSize, spacing } from "../utils/theme";
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

const STATUS_COLORS: Record<string, string> = {
  open: colors.danger,
  investigating: colors.warning,
  resolved: colors.green,
  dismissed: colors.textSecondary,
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
  const [activeTab, setActiveTab] = useState<TabKey>("cameras");
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewIncident, setShowNewIncident] = useState(false);

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
      const res = await api.getTransactions(
        selectedStoreId,
        dayAgo.toISOString(),
        now.toISOString()
      );
      setTransactions(res.transactions || []);
    } catch (err) {
      console.error("Timeline load error:", err);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    if (activeTab === "timeline") {
      loadTimeline();
    }
  }, [activeTab, loadTimeline]);

  if (!selectedStoreId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Select a store from the Dashboard first</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StorePicker />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(["cameras", "timeline", "incidents"] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "cameras" ? `Cameras (${cameras.length})` :
               tab === "timeline" ? "Timeline" :
               `Incidents (${incidents.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "cameras" && (
        <CamerasTab
          cameras={cameras}
          storeId={selectedStoreId}
          onRefresh={loadData}
        />
      )}

      {activeTab === "timeline" && (
        <TimelineTab
          transactions={transactions}
          cameras={cameras}
          storeId={selectedStoreId}
          navigation={navigation}
          onCreateIncident={(txn) => {
            setShowNewIncident(true);
          }}
        />
      )}

      {activeTab === "incidents" && (
        <IncidentsTab
          incidents={incidents}
          cameras={cameras}
          storeId={selectedStoreId}
          onNewIncident={() => setShowNewIncident(false)}
        />
      )}

      {/* New Incident FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowNewIncident(true)}
      >
        <Text style={styles.fabText}>+ Report</Text>
      </TouchableOpacity>

      <NewIncidentModal
        visible={showNewIncident}
        storeId={selectedStoreId}
        cameras={cameras}
        onClose={() => setShowNewIncident(false)}
        onCreated={() => {
          setShowNewIncident(false);
          loadData();
        }}
      />
    </View>
  );
}

// --- Cameras Tab ---

function CamerasTab({ cameras, storeId, onRefresh }: {
  cameras: CameraItem[];
  storeId: string;
  onRefresh: () => void;
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
      const result = await api.getCameraFootage(
        storeId,
        camera.cameraId,
        fiveMinAgo.toISOString(),
        now.toISOString()
      );
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
    <ScrollView style={styles.tabContent}>
      {cameras.length === 0 && !addingCamera ? (
        <View style={styles.emptySection}>
          <Text style={styles.emptySectionTitle}>No Cameras Registered</Text>
          <Text style={styles.emptySectionSub}>Add your Wyze cameras to enable surveillance features.</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddingCamera(true)}>
            <Text style={styles.addBtnText}>+ Add Camera</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {cameras.map((cam) => (
            <TouchableOpacity
              key={cam.cameraId}
              style={styles.cameraCard}
              onPress={() => requestFootage(cam)}
            >
              <View style={styles.cameraHeader}>
                <Text style={styles.cameraIcon}>
                  {LOCATION_ICONS[cam.location] || "📷"}
                </Text>
                <View style={styles.cameraInfo}>
                  <Text style={styles.cameraName}>{cam.name}</Text>
                  <Text style={styles.cameraLocation}>{cam.location}</Text>
                </View>
                <View style={[styles.statusDot, cam.isOnline ? styles.statusOnline : styles.statusOffline]} />
                <Text style={styles.statusText}>{cam.isOnline ? "Online" : "Offline"}</Text>
              </View>
              <View style={styles.cameraThumbnail}>
                <Text style={styles.thumbnailText}>
                  {cam.isOnline ? "Tap to view footage" : "Camera offline"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {!addingCamera && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setAddingCamera(true)}>
              <Text style={styles.addBtnText}>+ Add Camera</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {addingCamera && (
        <View style={styles.addCameraForm}>
          <Text style={styles.formTitle}>Register Wyze Camera</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Camera name (e.g. Front Register)"
            placeholderTextColor={colors.textSecondary}
            value={newCam.name}
            onChangeText={(t) => setNewCam({ ...newCam, name: t })}
          />
          <View style={styles.locationPicker}>
            {Object.entries(LOCATION_ICONS).map(([loc, icon]) => (
              <TouchableOpacity
                key={loc}
                style={[styles.locationBtn, newCam.location === loc && styles.locationBtnActive]}
                onPress={() => setNewCam({ ...newCam, location: loc })}
              >
                <Text style={styles.locationIcon}>{icon}</Text>
                <Text style={[styles.locationLabel, newCam.location === loc && styles.locationLabelActive]}>
                  {loc.replace("-", " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.formInput}
            placeholder="Wyze Device ID"
            placeholderTextColor={colors.textSecondary}
            value={newCam.wyzeDeviceId}
            onChangeText={(t) => setNewCam({ ...newCam, wyzeDeviceId: t })}
          />
          <TextInput
            style={styles.formInput}
            placeholder="Wyze Device MAC"
            placeholderTextColor={colors.textSecondary}
            value={newCam.wyzeDeviceMac}
            onChangeText={(t) => setNewCam({ ...newCam, wyzeDeviceMac: t })}
          />
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddingCamera(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddCamera}>
              <Text style={styles.saveBtnText}>Save Camera</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

// --- Timeline Tab ---

function TimelineTab({ transactions, cameras, storeId, navigation, onCreateIncident }: {
  transactions: TransactionItem[];
  cameras: CameraItem[];
  storeId: string;
  navigation: any;
  onCreateIncident: (txn: TransactionItem) => void;
}) {
  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatAmount = (n: number) => `$${n.toFixed(2)}`;

  if (transactions.length === 0) {
    return (
      <View style={[styles.tabContent, styles.centered]}>
        <Text style={styles.emptyText}>No transactions in the last 24 hours</Text>
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
            style={[styles.timelineCard, highCost && styles.timelineCardAlert]}
            onPress={() => {
              navigation.navigate("TransactionDetail", {
                transaction: item,
                storeId,
                cameras,
              });
            }}
          >
            <View style={styles.timelineDot}>
              <View style={[styles.dot, highCost ? styles.dotAlert : styles.dotNormal]} />
              <View style={styles.timelineLine} />
            </View>
            <View style={styles.timelineContent}>
              <View style={styles.timelineHeader}>
                <Text style={styles.timelineTime}>{formatTime(item.timestamp)}</Text>
                <Text style={[styles.timelineAmount, highCost && { color: colors.danger }]}>
                  {formatAmount(item.totalAmount)}
                </Text>
              </View>
              <Text style={styles.timelineItems}>
                {item.lineItems.map((li) => `${li.quantity}x ${li.recipeName}`).join(", ")}
              </Text>
              <View style={styles.timelineFooter}>
                <Text style={[styles.foodCostBadge, highCost && styles.foodCostHigh]}>
                  {item.foodCostPercentage.toFixed(1)}% food cost
                </Text>
                <TouchableOpacity
                  style={styles.flagBtn}
                  onPress={() => onCreateIncident(item)}
                >
                  <Text style={styles.flagText}>🚩 Flag</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

// --- Incidents Tab ---

function IncidentsTab({ incidents, cameras, storeId, onNewIncident }: {
  incidents: IncidentItem[];
  cameras: CameraItem[];
  storeId: string;
  onNewIncident: () => void;
}) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all"
    ? incidents
    : incidents.filter((i) => i.status === filter);

  const getCameraName = (cameraId?: string) => {
    if (!cameraId) return null;
    return cameras.find((c) => c.cameraId === cameraId)?.name || "Unknown Camera";
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const typeIcon = (type: string) =>
    INCIDENT_TYPES.find((t) => t.key === type)?.icon || "📝";

  return (
    <View style={styles.tabContent}>
      {/* Status Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {["all", "open", "investigating", "resolved", "dismissed"].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterBtn, filter === s && styles.filterBtnActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.filterText, filter === s && styles.filterTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptySection}>
          <Text style={styles.emptySectionTitle}>No Incidents</Text>
          <Text style={styles.emptySectionSub}>
            {filter === "all" ? "No incidents reported yet." : `No ${filter} incidents.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.incidentId}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => (
            <View style={styles.incidentCard}>
              <View style={styles.incidentHeader}>
                <Text style={styles.incidentIcon}>{typeIcon(item.type)}</Text>
                <View style={styles.incidentInfo}>
                  <Text style={styles.incidentTitle}>{item.title}</Text>
                  <Text style={styles.incidentDate}>{formatDate(item.timestamp)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || colors.textSecondary }]}>
                  <Text style={styles.statusBadgeText}>{item.status}</Text>
                </View>
              </View>
              {item.notes ? <Text style={styles.incidentNotes}>{item.notes}</Text> : null}
              <View style={styles.incidentMeta}>
                {item.cameraId && (
                  <Text style={styles.metaTag}>📷 {getCameraName(item.cameraId)}</Text>
                )}
                {item.transactionId && (
                  <Text style={styles.metaTag}>💳 Transaction linked</Text>
                )}
                {item.wasteId && (
                  <Text style={styles.metaTag}>🗑 Waste log linked</Text>
                )}
                <Text style={styles.metaTag}>By: {item.createdBy}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// --- New Incident Modal ---

function NewIncidentModal({ visible, storeId, cameras, onClose, onCreated }: {
  visible: boolean;
  storeId: string;
  cameras: CameraItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCamera, setSelectedCamera] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!type || !title) {
      Alert.alert("Missing Info", "Select a type and add a title.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createIncident(storeId, {
        type,
        title,
        notes,
        timestamp: new Date().toISOString(),
        cameraId: selectedCamera || undefined,
      });
      setType("");
      setTitle("");
      setNotes("");
      setSelectedCamera("");
      onCreated();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create incident");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report Incident</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView>
            <Text style={styles.formLabel}>Type</Text>
            <View style={styles.typeGrid}>
              {INCIDENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeBtn, type === t.key && styles.typeBtnActive]}
                  onPress={() => setType(t.key)}
                >
                  <Text style={styles.typeIcon}>{t.icon}</Text>
                  <Text style={[styles.typeLabel, type === t.key && styles.typeLabelActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Title</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Brief description..."
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.formLabel}>Notes</Text>
            <TextInput
              style={[styles.formInput, { minHeight: 80, textAlignVertical: "top" }]}
              placeholder="Details..."
              placeholderTextColor={colors.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            {cameras.length > 0 && (
              <>
                <Text style={styles.formLabel}>Link Camera (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {cameras.map((cam) => (
                    <TouchableOpacity
                      key={cam.cameraId}
                      style={[styles.camChip, selectedCamera === cam.cameraId && styles.camChipActive]}
                      onPress={() => setSelectedCamera(
                        selectedCamera === cam.cameraId ? "" : cam.cameraId
                      )}
                    >
                      <Text style={styles.camChipText}>
                        {LOCATION_ICONS[cam.location] || "📷"} {cam.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Create Incident</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center" },

  // Tab Bar
  tabBar: { flexDirection: "row", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary },
  tabTextActive: { color: colors.primary },

  tabContent: { flex: 1 },

  // Camera Cards
  cameraCard: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    marginBottom: 0,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  cameraIcon: { fontSize: 28, marginRight: spacing.sm },
  cameraInfo: { flex: 1 },
  cameraName: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
  cameraLocation: { fontSize: fontSize.sm, color: colors.textSecondary, textTransform: "capitalize" },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.xs },
  statusOnline: { backgroundColor: colors.green },
  statusOffline: { backgroundColor: colors.red },
  statusText: { fontSize: fontSize.xs, color: colors.textSecondary },
  cameraThumbnail: {
    backgroundColor: "#1a202c",
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailText: { color: "rgba(255,255,255,0.6)", fontSize: fontSize.sm },

  // Empty Section
  emptySection: { alignItems: "center", padding: spacing.xl, marginTop: spacing.xl },
  emptySectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  emptySectionSub: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.lg },

  // Add Camera
  addBtn: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: 10,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.md },

  addCameraForm: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  formInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  formLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  locationPicker: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  locationBtn: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: "center",
    width: "30%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationBtnActive: { borderColor: colors.primary, backgroundColor: "#EBF8FF" },
  locationIcon: { fontSize: 20 },
  locationLabel: { fontSize: fontSize.xs, color: colors.textSecondary, textTransform: "capitalize", marginTop: 2 },
  locationLabelActive: { color: colors.primary },

  formActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: 10, alignItems: "center", backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.textSecondary, fontWeight: "600" },
  saveBtn: { flex: 1, padding: spacing.md, borderRadius: 10, alignItems: "center", backgroundColor: colors.primary },
  saveBtnText: { color: "#fff", fontWeight: "700" },

  // Timeline
  timelineCard: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  timelineCardAlert: {},
  timelineDot: { width: 24, alignItems: "center", marginRight: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  dotNormal: { backgroundColor: colors.primary },
  dotAlert: { backgroundColor: colors.danger },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  timelineContent: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  timelineTime: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
  timelineAmount: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
  timelineItems: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  timelineFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  foodCostBadge: { fontSize: fontSize.xs, color: colors.textSecondary, backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  foodCostHigh: { backgroundColor: "#FED7D7", color: colors.danger },
  flagBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  flagText: { fontSize: fontSize.sm },

  // Incidents
  filterRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: fontSize.sm, color: colors.textSecondary },
  filterTextActive: { color: "#fff" },

  incidentCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  incidentHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  incidentIcon: { fontSize: 24, marginRight: spacing.sm },
  incidentInfo: { flex: 1 },
  incidentTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
  incidentDate: { fontSize: fontSize.xs, color: colors.textSecondary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusBadgeText: { fontSize: fontSize.xs, color: "#fff", fontWeight: "700", textTransform: "capitalize" },
  incidentNotes: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  incidentMeta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  metaTag: { fontSize: fontSize.xs, color: colors.textSecondary, backgroundColor: colors.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  // FAB
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 25,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: fontSize.md },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    padding: spacing.lg,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.text },
  modalClose: { fontSize: fontSize.xl, color: colors.textSecondary, padding: spacing.sm },

  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  typeBtn: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.sm,
    alignItems: "center",
    width: "30%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: "#EBF8FF" },
  typeIcon: { fontSize: 24, marginBottom: 2 },
  typeLabel: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: "600" },
  typeLabelActive: { color: colors.primary },

  camChip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  camChipActive: { borderColor: colors.primary, backgroundColor: "#EBF8FF" },
  camChipText: { fontSize: fontSize.sm, color: colors.text },

  submitBtn: {
    backgroundColor: colors.danger,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
});
