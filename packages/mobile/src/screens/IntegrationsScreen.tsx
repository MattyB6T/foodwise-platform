import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

interface PosConnection {
  storeId: string;
  connectionId: string;
  posSystem: string;
  status: string;
  lastSyncAt: string | null;
  syncStats: {
    totalTransactions: number;
    lastError: string | null;
  };
  createdAt: string;
}

const POS_SYSTEMS = [
  { id: "toast", name: "Toast", icon: "T", color: "#FF6F00" },
  { id: "square", name: "Square", icon: "S", color: "#006AFF" },
  { id: "csv", name: "CSV Import", icon: "C", color: "#607D8B" },
];

function getStatusColor(status: string, lastError: string | null): string {
  if (lastError) return "#F44336";
  if (status === "active") return "#4CAF50";
  if (status === "paused") return "#FF9800";
  return "#9E9E9E";
}

function getStatusLabel(status: string, lastError: string | null): string {
  if (lastError) return "Error";
  if (status === "active") return "Connected";
  if (status === "paused") return "Paused";
  return "Inactive";
}

function timeSince(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function IntegrationsScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [connections, setConnections] = useState<PosConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const styles = createStyles(colors);

  const loadData = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const result = await api.listPosConnections(selectedStoreId);
      const conns = result.connections || [];
      setConnections(conns);
      setTotalTransactions(
        conns.reduce((sum: number, c: PosConnection) => sum + (c.syncStats?.totalTransactions || 0), 0)
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddConnection = (posSystem: string) => {
    if (!selectedStoreId) return;

    Alert.prompt
      ? Alert.prompt(
          `Add ${posSystem.toUpperCase()} Connection`,
          "Enter webhook secret or API key:",
          async (value) => {
            if (!value) return;
            try {
              await api.createPosConnection(selectedStoreId, {
                posSystem,
                config: posSystem === "toast" ? { webhookSecret: value } : { accessToken: value },
              });
              loadData();
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          }
        )
      : Alert.alert(
          `Add ${posSystem.toUpperCase()}`,
          "Connection will be created. Configure credentials in the web dashboard.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Create",
              onPress: async () => {
                try {
                  await api.createPosConnection(selectedStoreId!, { posSystem, config: {} });
                  loadData();
                } catch (err: any) {
                  Alert.alert("Error", err.message);
                }
              },
            },
          ]
        );
  };

  const handleToggleConnection = async (connection: PosConnection) => {
    if (!selectedStoreId) return;
    const newStatus = connection.status === "active" ? "paused" : "active";
    try {
      await api.updatePosConnection(selectedStoreId, connection.connectionId, { status: newStatus });
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleDeleteConnection = (connection: PosConnection) => {
    Alert.alert("Delete Connection", `Remove ${connection.posSystem.toUpperCase()} integration?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deletePosConnection(selectedStoreId!, connection.connectionId);
            loadData();
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  const renderConnection = ({ item }: { item: PosConnection }) => {
    const posInfo = POS_SYSTEMS.find((p) => p.id === item.posSystem) || POS_SYSTEMS[2];
    const statusColor = getStatusColor(item.status, item.syncStats?.lastError);
    const statusLabel = getStatusLabel(item.status, item.syncStats?.lastError);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.posIcon, { backgroundColor: posInfo.color }]}>
            <Text style={styles.posIconText}>{posInfo.icon}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.posName}>{posInfo.name}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => handleToggleConnection(item)}>
            <Text style={styles.toggleText}>
              {item.status === "active" ? "Pause" : "Resume"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{item.syncStats?.totalTransactions || 0}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{timeSince(item.lastSyncAt)}</Text>
            <Text style={styles.statLabel}>Last Sync</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            <Text style={styles.statLabel}>Connected</Text>
          </View>
        </View>

        {item.syncStats?.lastError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{item.syncStats.lastError}</Text>
          </View>
        )}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.cardAction}
            onPress={() =>
              navigation.navigate("MappingScreen", {
                connectionId: item.connectionId,
                posSystem: item.posSystem,
              })
            }
          >
            <Text style={styles.cardActionText}>View Mappings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cardAction, styles.deleteAction]}
            onPress={() => handleDeleteConnection(item)}
          >
            <Text style={[styles.cardActionText, { color: "#F44336" }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StorePicker />

      {/* Summary Stats */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{connections.length}</Text>
          <Text style={styles.summaryLabel}>Integrations</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalTransactions}</Text>
          <Text style={styles.summaryLabel}>Total Synced</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {connections.filter((c) => c.status === "active" && !c.syncStats?.lastError).length}
          </Text>
          <Text style={styles.summaryLabel}>Healthy</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(item) => item.connectionId}
          renderItem={renderConnection}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <Text style={styles.sectionTitle}>Active Connections</Text>
            </View>
          }
          ListFooterComponent={
            <View>
              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
                Add Integration
              </Text>
              <View style={styles.addRow}>
                {POS_SYSTEMS.map((pos) => (
                  <TouchableOpacity
                    key={pos.id}
                    style={styles.addCard}
                    onPress={() => handleAddConnection(pos.id)}
                  >
                    <View style={[styles.posIcon, { backgroundColor: pos.color }]}>
                      <Text style={styles.posIconText}>{pos.icon}</Text>
                    </View>
                    <Text style={styles.addCardText}>{pos.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              No POS integrations yet. Add one below to start syncing transactions.
            </Text>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    summary: {
      flexDirection: "row",
      padding: spacing.md,
      gap: spacing.sm,
    },
    summaryItem: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing.md,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryValue: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
    summaryLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
    sectionTitle: {
      fontSize: fontSize.md,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    posIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    posIconText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "700" },
    cardInfo: { flex: 1, marginLeft: spacing.sm },
    posName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: fontSize.xs, fontWeight: "500" },
    toggleText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: "500" },
    statsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    stat: { flex: 1, alignItems: "center" },
    statValue: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
    statLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
    errorBox: {
      backgroundColor: "#FFEBEE",
      borderRadius: 6,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    errorText: { color: "#D32F2F", fontSize: fontSize.xs },
    cardActions: {
      flexDirection: "row",
      gap: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    cardAction: { flex: 1, alignItems: "center", paddingVertical: spacing.xs },
    deleteAction: {},
    cardActionText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: "500" },
    addRow: { flexDirection: "row", gap: spacing.sm },
    addCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing.md,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
    },
    addCardText: { fontSize: fontSize.sm, color: colors.text, marginTop: spacing.xs },
    loader: { marginTop: spacing.xl },
    empty: {
      textAlign: "center",
      color: colors.textSecondary,
      fontSize: fontSize.md,
      marginVertical: spacing.lg,
    },
  });
