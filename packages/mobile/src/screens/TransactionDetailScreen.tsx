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
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";

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

  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [loadingFootage, setLoadingFootage] = useState<string | null>(null);

  const txnDate = new Date(transaction.timestamp);
  const formattedDate = txnDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const formattedTime = txnDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const highCost = transaction.foodCostPercentage > 35;

  const requestFootage = async (camera: CameraItem) => {
    setLoadingFootage(camera.cameraId);
    try {
      const start = new Date(txnDate.getTime() - 2 * 60 * 1000);
      const end = new Date(txnDate.getTime() + 2 * 60 * 1000);
      const result = await api.getCameraFootage(storeId, camera.cameraId, start.toISOString(), end.toISOString());
      if (result.status === "camera_offline") {
        Alert.alert("Camera Offline", `${camera.name} was offline at the time of this transaction.`);
      } else {
        Alert.alert("Footage Retrieved", `Showing ${camera.name} footage from ${start.toLocaleTimeString()} to ${end.toLocaleTimeString()}.${result.playbackUrl ? "\n\nStream ready." : "\n\nProcessing playback request..."}`);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to retrieve footage");
    } finally {
      setLoadingFootage(null);
    }
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.primary }]}>
        <Text style={s.headerDate}>{formattedDate}</Text>
        <Text style={s.headerTime}>{formattedTime}</Text>
        <Text style={s.headerAmount}>${transaction.totalAmount.toFixed(2)}</Text>
        <View style={[s.costBadge, highCost && s.costBadgeHigh]}>
          <Text style={[s.costBadgeText, highCost && s.costBadgeTextHigh]}>
            {transaction.foodCostPercentage.toFixed(1)}% food cost
          </Text>
        </View>
      </View>

      <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Items Sold</Text>
        {transaction.lineItems.map((item, i) => (
          <View key={i} style={s.lineItem}>
            <Text style={[s.lineQty, { color: colors.primary }]}>{item.quantity}x</Text>
            <Text style={[s.lineName, { color: colors.text }]}>{item.recipeName}</Text>
            <Text style={[s.linePrice, { color: colors.text }]}>${item.price.toFixed(2)}</Text>
          </View>
        ))}
        <View style={[s.totalRow, { borderTopColor: colors.border }]}>
          <Text style={[s.totalLabel, { color: colors.textSecondary }]}>Total</Text>
          <Text style={[s.totalValue, { color: colors.text }]}>${transaction.totalAmount.toFixed(2)}</Text>
        </View>
        {transaction.foodCost !== undefined && (
          <View style={[s.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[s.totalLabel, { color: colors.textSecondary }]}>Food Cost</Text>
            <Text style={[s.totalValue, { color: highCost ? colors.danger : colors.text }]}>
              ${transaction.foodCost.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {transaction.ingredientDeductions && transaction.ingredientDeductions.length > 0 && (
        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Ingredients Used</Text>
          {transaction.ingredientDeductions.map((d, i) => (
            <View key={i} style={s.deductionRow}>
              <Text style={[s.deductionName, { color: colors.text }]}>{d.itemName}</Text>
              <Text style={[s.deductionQty, { color: colors.textSecondary }]}>{d.quantityDeducted} {d.unit}</Text>
              <Text style={[s.deductionCost, { color: colors.text }]}>${d.totalCost.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Camera Footage</Text>
        <Text style={[s.footageNote, { color: colors.textSecondary }]}>
          View footage from 2 minutes before and after this transaction
        </Text>
        {cameras.length === 0 ? (
          <Text style={[s.noCameras, { color: colors.textSecondary }]}>No cameras registered for this store</Text>
        ) : (
          cameras.map((cam) => (
            <TouchableOpacity
              key={cam.cameraId}
              style={[s.cameraBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => requestFootage(cam)}
              disabled={loadingFootage === cam.cameraId}
            >
              <View style={s.cameraBtnContent}>
                <View style={[s.camDot, { backgroundColor: cam.isOnline ? colors.green : colors.red }]} />
                <View style={s.camInfo}>
                  <Text style={[s.camName, { color: colors.text }]}>{cam.name}</Text>
                  <Text style={[s.camLoc, { color: colors.textSecondary }]}>{cam.location}</Text>
                </View>
                {loadingFootage === cam.cameraId ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[s.viewBtn, { color: colors.primary }]}>View →</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={s.idSection}>
        <Text style={[s.idLabel, { color: colors.textSecondary }]}>Transaction ID</Text>
        <Text style={[s.idValue, { color: colors.textSecondary }]}>{transaction.transactionId}</Text>
      </View>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: { padding: spacing.lg, alignItems: "center" },
    headerDate: { color: "rgba(255,255,255,0.7)", fontSize: fontSize.sm },
    headerTime: { color: "#fff", fontSize: fontSize.xl, fontWeight: "800", marginTop: 2 },
    headerAmount: { color: "#fff", fontSize: fontSize.xxl, fontWeight: "800", marginTop: spacing.sm },
    costBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 20, marginTop: spacing.sm },
    costBadgeHigh: { backgroundColor: "rgba(229,62,62,0.3)" },
    costBadgeText: { color: "rgba(255,255,255,0.8)", fontSize: fontSize.sm, fontWeight: "600" },
    costBadgeTextHigh: { color: colors.danger },
    section: { margin: spacing.md, marginBottom: 0, borderRadius: 12, padding: spacing.md, borderWidth: 1 },
    sectionTitle: { fontSize: fontSize.md, fontWeight: "700", marginBottom: spacing.sm },
    lineItem: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs },
    lineQty: { fontSize: fontSize.sm, fontWeight: "700", width: 30 },
    lineName: { flex: 1, fontSize: fontSize.md },
    linePrice: { fontSize: fontSize.md, fontWeight: "600" },
    totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1 },
    totalLabel: { fontSize: fontSize.md, fontWeight: "600" },
    totalValue: { fontSize: fontSize.md, fontWeight: "700" },
    deductionRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs },
    deductionName: { flex: 1, fontSize: fontSize.sm },
    deductionQty: { fontSize: fontSize.sm, marginRight: spacing.md },
    deductionCost: { fontSize: fontSize.sm, fontWeight: "600" },
    footageNote: { fontSize: fontSize.sm, marginBottom: spacing.sm },
    noCameras: { fontSize: fontSize.sm, fontStyle: "italic" },
    cameraBtn: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.xs, borderWidth: 1 },
    cameraBtnContent: { flexDirection: "row", alignItems: "center" },
    camDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
    camInfo: { flex: 1 },
    camName: { fontSize: fontSize.sm, fontWeight: "600" },
    camLoc: { fontSize: fontSize.xs, textTransform: "capitalize" },
    viewBtn: { fontSize: fontSize.sm, fontWeight: "700" },
    idSection: { padding: spacing.md, marginHorizontal: spacing.md, marginTop: spacing.md, alignItems: "center" },
    idLabel: { fontSize: fontSize.xs },
    idValue: { fontSize: fontSize.xs, fontFamily: "monospace" },
  });
