import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { api } from "../utils/api";
import { colors, fontSize, spacing } from "../utils/theme";

interface TransactionLineItem {
  recipeId: string;
  recipeName: string;
  quantity: number;
  price: number;
}

interface CameraItem {
  cameraId: string;
  name: string;
  location: string;
  isOnline: boolean;
}

export function TransactionDetailScreen({ route }: { route: any }) {
  const { transaction, storeId, cameras } = route.params as {
    transaction: {
      transactionId: string;
      timestamp: string;
      totalAmount: number;
      foodCost: number;
      foodCostPercentage: number;
      lineItems: TransactionLineItem[];
      ingredientDeductions?: { itemName: string; quantityDeducted: number; unit: string; totalCost: number }[];
    };
    storeId: string;
    cameras: CameraItem[];
  };

  const [loadingFootage, setLoadingFootage] = useState<string | null>(null);

  const txnDate = new Date(transaction.timestamp);
  const formattedDate = txnDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const formattedTime = txnDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const highCost = transaction.foodCostPercentage > 35;

  const requestFootage = async (camera: CameraItem) => {
    setLoadingFootage(camera.cameraId);
    try {
      // 2 minutes before and after the transaction
      const start = new Date(txnDate.getTime() - 2 * 60 * 1000);
      const end = new Date(txnDate.getTime() + 2 * 60 * 1000);

      const result = await api.getCameraFootage(
        storeId,
        camera.cameraId,
        start.toISOString(),
        end.toISOString()
      );

      if (result.status === "camera_offline") {
        Alert.alert("Camera Offline", `${camera.name} was offline at the time of this transaction.`);
      } else {
        Alert.alert(
          "Footage Retrieved",
          `Showing ${camera.name} footage from ${start.toLocaleTimeString()} to ${end.toLocaleTimeString()}.${result.playbackUrl ? "\n\nStream ready." : "\n\nProcessing playback request..."}`
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to retrieve footage");
    } finally {
      setLoadingFootage(null);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Transaction Header */}
      <View style={styles.header}>
        <Text style={styles.headerDate}>{formattedDate}</Text>
        <Text style={styles.headerTime}>{formattedTime}</Text>
        <Text style={styles.headerAmount}>${transaction.totalAmount.toFixed(2)}</Text>
        <View style={[styles.costBadge, highCost && styles.costBadgeHigh]}>
          <Text style={[styles.costBadgeText, highCost && styles.costBadgeTextHigh]}>
            {transaction.foodCostPercentage.toFixed(1)}% food cost
          </Text>
        </View>
      </View>

      {/* Line Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items Sold</Text>
        {transaction.lineItems.map((item, i) => (
          <View key={i} style={styles.lineItem}>
            <Text style={styles.lineQty}>{item.quantity}x</Text>
            <Text style={styles.lineName}>{item.recipeName}</Text>
            <Text style={styles.linePrice}>${item.price.toFixed(2)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${transaction.totalAmount.toFixed(2)}</Text>
        </View>
        {transaction.foodCost !== undefined && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Food Cost</Text>
            <Text style={[styles.totalValue, highCost && { color: colors.danger }]}>
              ${transaction.foodCost.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {/* Ingredient Deductions */}
      {transaction.ingredientDeductions && transaction.ingredientDeductions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients Used</Text>
          {transaction.ingredientDeductions.map((d, i) => (
            <View key={i} style={styles.deductionRow}>
              <Text style={styles.deductionName}>{d.itemName}</Text>
              <Text style={styles.deductionQty}>
                {d.quantityDeducted} {d.unit}
              </Text>
              <Text style={styles.deductionCost}>${d.totalCost.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Camera Footage */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Camera Footage</Text>
        <Text style={styles.footageNote}>
          View footage from 2 minutes before and after this transaction
        </Text>
        {cameras.length === 0 ? (
          <Text style={styles.noCameras}>No cameras registered for this store</Text>
        ) : (
          cameras.map((cam) => (
            <TouchableOpacity
              key={cam.cameraId}
              style={styles.cameraBtn}
              onPress={() => requestFootage(cam)}
              disabled={loadingFootage === cam.cameraId}
            >
              <View style={styles.cameraBtnContent}>
                <View style={[styles.camDot, cam.isOnline ? styles.camOnline : styles.camOffline]} />
                <View style={styles.camInfo}>
                  <Text style={styles.camName}>{cam.name}</Text>
                  <Text style={styles.camLoc}>{cam.location}</Text>
                </View>
                {loadingFootage === cam.cameraId ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.viewBtn}>View →</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Transaction ID */}
      <View style={styles.idSection}>
        <Text style={styles.idLabel}>Transaction ID</Text>
        <Text style={styles.idValue}>{transaction.transactionId}</Text>
      </View>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    alignItems: "center",
  },
  headerDate: { color: "rgba(255,255,255,0.7)", fontSize: fontSize.sm },
  headerTime: { color: "#fff", fontSize: fontSize.xl, fontWeight: "800", marginTop: 2 },
  headerAmount: { color: "#fff", fontSize: fontSize.xxl, fontWeight: "800", marginTop: spacing.sm },
  costBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginTop: spacing.sm,
  },
  costBadgeHigh: { backgroundColor: "rgba(229,62,62,0.3)" },
  costBadgeText: { color: "rgba(255,255,255,0.8)", fontSize: fontSize.sm, fontWeight: "600" },
  costBadgeTextHigh: { color: "#FED7D7" },

  section: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    marginBottom: 0,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },

  lineItem: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs },
  lineQty: { fontSize: fontSize.sm, fontWeight: "700", color: colors.primary, width: 30 },
  lineName: { flex: 1, fontSize: fontSize.md, color: colors.text },
  linePrice: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: fontSize.md, fontWeight: "600", color: colors.textSecondary },
  totalValue: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },

  deductionRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs },
  deductionName: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  deductionQty: { fontSize: fontSize.sm, color: colors.textSecondary, marginRight: spacing.md },
  deductionCost: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },

  footageNote: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  noCameras: { fontSize: fontSize.sm, color: colors.textSecondary, fontStyle: "italic" },

  cameraBtn: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cameraBtnContent: { flexDirection: "row", alignItems: "center" },
  camDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  camOnline: { backgroundColor: colors.green },
  camOffline: { backgroundColor: colors.red },
  camInfo: { flex: 1 },
  camName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  camLoc: { fontSize: fontSize.xs, color: colors.textSecondary, textTransform: "capitalize" },
  viewBtn: { fontSize: fontSize.sm, fontWeight: "700", color: colors.primary },

  idSection: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    alignItems: "center",
  },
  idLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  idValue: { fontSize: fontSize.xs, color: colors.textSecondary, fontFamily: "monospace" },
});
