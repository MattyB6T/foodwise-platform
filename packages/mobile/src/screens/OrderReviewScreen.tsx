import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

export function OrderReviewScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editedLines, setEditedLines] = useState<any[]>([]);
  const s = makeStyles(colors);

  useEffect(() => {
    if (!selectedStoreId) return;
    api
      .getPurchaseOrders(selectedStoreId)
      .then((res) => setOrders(res.orders || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedStoreId]);

  const selectOrder = (order: any) => {
    setSelectedOrder(order);
    setEditedLines(order.lines.map((line: any) => ({ ...line })));
  };

  const updateLineQty = (index: number, qty: string) => {
    const num = parseInt(qty, 10);
    if (isNaN(num)) return;
    setEditedLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, quantityOrdered: num } : line))
    );
  };

  const approveOrder = async () => {
    if (!selectedOrder) return;
    Alert.alert(
      "Approve Order",
      `Submit this purchase order to ${selectedOrder.supplierName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            try {
              Alert.alert("Order Submitted", "Purchase order has been sent to the supplier.");
              setSelectedOrder(null);
              if (selectedStoreId) {
                const res = await api.getPurchaseOrders(selectedStoreId);
                setOrders(res.orders || []);
              }
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
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

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (selectedOrder) {
    const totalCost = editedLines.reduce(
      (sum: number, line: any) => sum + line.quantityOrdered * line.unitCost, 0
    );

    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.orderHeader}>
          <TouchableOpacity onPress={() => setSelectedOrder(null)}>
            <Text style={[s.backBtn, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[s.orderTitle, { color: colors.text }]}>{selectedOrder.supplierName}</Text>
          <View
            style={[
              s.statusBadge,
              {
                backgroundColor:
                  selectedOrder.status === "draft" ? colors.warning
                    : selectedOrder.status === "submitted" ? colors.primaryLight
                    : colors.secondary,
              },
            ]}
          >
            <Text style={s.statusText}>{selectedOrder.status}</Text>
          </View>
        </View>

        <Text style={[s.deliveryDate, { color: colors.textSecondary }]}>
          Expected: {selectedOrder.expectedDeliveryDate}
        </Text>

        <FlatList
          data={editedLines}
          keyExtractor={(item, i) => `${item.itemId}-${i}`}
          renderItem={({ item, index }) => (
            <View style={[s.lineCard, { backgroundColor: colors.surface }]}>
              <View style={s.lineInfo}>
                <Text style={[s.lineName, { color: colors.text }]}>{item.itemName}</Text>
                <Text style={[s.lineDetail, { color: colors.textSecondary }]}>
                  ${item.unitCost}/{item.unit}
                  {item.quantityReceived > 0 && ` | Received: ${item.quantityReceived}`}
                </Text>
              </View>
              {selectedOrder.status === "draft" ? (
                <TextInput
                  style={[s.lineQtyInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={item.quantityOrdered.toString()}
                  onChangeText={(val) => updateLineQty(index, val)}
                  keyboardType="numeric"
                />
              ) : (
                <Text style={[s.lineQtyFixed, { color: colors.text }]}>
                  {item.quantityOrdered} {item.unit}
                </Text>
              )}
              <Text style={[s.lineCost, { color: colors.text }]}>
                ${(item.quantityOrdered * item.unitCost).toFixed(2)}
              </Text>
            </View>
          )}
        />

        <View style={[s.totalBar, { borderTopColor: colors.border }]}>
          <Text style={[s.totalLabel, { color: colors.text }]}>Total</Text>
          <Text style={[s.totalValue, { color: colors.primary }]}>${totalCost.toFixed(2)}</Text>
        </View>

        {selectedOrder.status === "draft" && (
          <TouchableOpacity style={[s.approveBtn, { backgroundColor: colors.secondary }]} onPress={approveOrder}>
            <Text style={s.approveText}>Approve & Submit Order</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const draftOrders = orders.filter((o) => o.status === "draft");
  const activeOrders = orders.filter((o) => ["submitted", "partial"].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === "received");

  return (
    <FlatList
      style={[s.container, { backgroundColor: colors.background }]}
      ListHeaderComponent={<StorePicker />}
      data={[
        ...(draftOrders.length > 0
          ? [{ type: "header", title: `Draft Orders (${draftOrders.length})` }, ...draftOrders.map((o) => ({ type: "order", ...o }))]
          : []),
        ...(activeOrders.length > 0
          ? [{ type: "header", title: `Active Orders (${activeOrders.length})` }, ...activeOrders.map((o) => ({ type: "order", ...o }))]
          : []),
        ...(completedOrders.length > 0
          ? [{ type: "header", title: `Completed (${completedOrders.length})` }, ...completedOrders.map((o) => ({ type: "order", ...o }))]
          : []),
      ]}
      keyExtractor={(item: any, i) => item.orderId || `header-${i}`}
      renderItem={({ item }: { item: any }) => {
        if (item.type === "header") {
          return <Text style={[s.sectionHeader, { color: colors.text }]}>{item.title}</Text>;
        }
        return (
          <TouchableOpacity
            style={[s.orderCard, { backgroundColor: colors.surface }]}
            onPress={() => selectOrder(item)}
          >
            <View style={s.orderRow}>
              <View>
                <Text style={[s.orderSupplier, { color: colors.text }]}>{item.supplierName}</Text>
                <Text style={[s.orderMeta, { color: colors.textSecondary }]}>
                  {item.lines?.length || 0} items | Expected: {item.expectedDeliveryDate}
                </Text>
              </View>
              <View style={s.orderRight}>
                <Text style={[s.orderTotal, { color: colors.text }]}>
                  ${item.totalCost?.toFixed(2)}
                </Text>
                <View
                  style={[
                    s.statusBadgeSm,
                    {
                      backgroundColor:
                        item.status === "draft" ? colors.warning
                          : item.status === "submitted" ? colors.primaryLight
                          : item.status === "partial" ? colors.warning
                          : colors.secondary,
                    },
                  ]}
                >
                  <Text style={s.statusTextSm}>{item.status}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={[s.emptyText, { color: colors.textSecondary }]}>No purchase orders found</Text>
        </View>
      }
    />
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    sectionHeader: { fontSize: fontSize.md, fontWeight: "700", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
    orderCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: 10, padding: spacing.md },
    orderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    orderSupplier: { fontSize: fontSize.md, fontWeight: "600" },
    orderMeta: { fontSize: fontSize.xs, marginTop: 2 },
    orderRight: { alignItems: "flex-end" },
    orderTotal: { fontSize: fontSize.md, fontWeight: "700" },
    statusBadgeSm: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
    statusTextSm: { color: "#fff", fontSize: fontSize.xs, fontWeight: "600" },
    empty: { padding: spacing.xl, alignItems: "center" },
    emptyText: { fontSize: fontSize.md },
    orderHeader: { flexDirection: "row", alignItems: "center", padding: spacing.lg, gap: spacing.md },
    backBtn: { fontSize: fontSize.md, fontWeight: "600" },
    orderTitle: { fontSize: fontSize.lg, fontWeight: "700", flex: 1 },
    statusBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
    statusText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600" },
    deliveryDate: { fontSize: fontSize.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    lineCard: { marginHorizontal: spacing.lg, marginBottom: spacing.xs, borderRadius: 8, padding: spacing.md, flexDirection: "row", alignItems: "center" },
    lineInfo: { flex: 1 },
    lineName: { fontSize: fontSize.md, fontWeight: "600" },
    lineDetail: { fontSize: fontSize.xs, marginTop: 2 },
    lineQtyInput: { borderRadius: 8, width: 60, textAlign: "center", padding: spacing.sm, fontSize: fontSize.md, fontWeight: "700", borderWidth: 1, marginRight: spacing.sm },
    lineQtyFixed: { fontSize: fontSize.md, fontWeight: "600", marginRight: spacing.sm },
    lineCost: { fontSize: fontSize.sm, fontWeight: "600", width: 70, textAlign: "right" },
    totalBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1 },
    totalLabel: { fontSize: fontSize.lg, fontWeight: "700" },
    totalValue: { fontSize: fontSize.lg, fontWeight: "700" },
    approveBtn: { margin: spacing.lg, padding: spacing.md, borderRadius: 12, alignItems: "center" },
    approveText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
  });
