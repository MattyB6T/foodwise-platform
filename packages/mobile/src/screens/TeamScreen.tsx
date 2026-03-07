import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../contexts/StoreContext";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, borderRadius, type ColorScheme } from "../utils/theme";

const ROLES = [
  { key: "owner", label: "Owner", description: "Full access to everything", color: "#e53e3e" },
  { key: "manager", label: "Manager", description: "Staff management & reports", color: "#dd6b20" },
  { key: "staff", label: "Staff", description: "Daily operations & timeclock", color: "#38a169" },
  { key: "readonly", label: "View Only", description: "Read-only dashboard access", color: "#718096" },
] as const;

interface TeamMember {
  staffId: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  hourlyRate: number | null;
  active: boolean;
  createdAt: string;
}

export function TeamScreen() {
  const { selectedStoreId } = useStore();
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [roleModal, setRoleModal] = useState<TeamMember | null>(null);

  const userRole = user?.groups?.includes("owner") ? "owner" : user?.groups?.includes("manager") ? "manager" : "staff";

  const loadTeam = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const result = await api.getTeam(selectedStoreId);
      setMembers(result.members || []);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  if (!selectedStoreId) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: fontSize.md, color: colors.textSecondary }}>Select a store first</Text>
      </View>
    );
  }

  const roleColor = (role: string) => ROLES.find((r) => r.key === role)?.color || "#718096";

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: colors.text }]}>Team</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            {members.filter((m) => m.active).length} active members
          </Text>
        </View>
        {(userRole === "owner" || userRole === "manager") && (
          <TouchableOpacity
            style={[s.inviteBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowInvite(true)}
          >
            <Ionicons name="person-add" size={18} color="#fff" />
            <Text style={s.inviteBtnText}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
          {members.map((member) => (
            <View
              key={member.staffId}
              style={[
                s.memberCard,
                { backgroundColor: colors.card, borderColor: colors.borderLight, opacity: member.active ? 1 : 0.5 },
              ]}
            >
              <View style={s.memberTop}>
                <View style={[s.avatar, { backgroundColor: roleColor(member.role) + "20" }]}>
                  <Text style={[s.avatarText, { color: roleColor(member.role) }]}>
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.memberName, { color: colors.text }]}>{member.name}</Text>
                  <Text style={[s.memberEmail, { color: colors.textSecondary }]}>{member.email}</Text>
                </View>
                <View style={[s.roleBadge, { backgroundColor: roleColor(member.role) + "18" }]}>
                  <Text style={[s.roleBadgeText, { color: roleColor(member.role) }]}>
                    {member.role}
                  </Text>
                </View>
              </View>

              {/* Member details */}
              <View style={s.memberDetails}>
                {member.phone && (
                  <Text style={[s.detailText, { color: colors.textSecondary }]}>
                    {member.phone}
                  </Text>
                )}
                {member.hourlyRate !== null && member.hourlyRate !== undefined && (
                  <Text style={[s.detailText, { color: colors.textSecondary }]}>
                    ${member.hourlyRate}/hr
                  </Text>
                )}
                {!member.active && (
                  <Text style={[s.detailText, { color: "#e53e3e" }]}>Inactive</Text>
                )}
              </View>

              {/* Actions for managers/owners */}
              {(userRole === "owner" || userRole === "manager") && member.email !== user?.email && member.active && (
                <View style={s.memberActions}>
                  <TouchableOpacity
                    style={[s.actionBtn, { borderColor: colors.borderLight }]}
                    onPress={() => setRoleModal(member)}
                  >
                    <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
                    <Text style={[s.actionBtnText, { color: colors.primary }]}>Change Role</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, { borderColor: "#fed7d7" }]}
                    onPress={() => {
                      Alert.alert(
                        "Deactivate User",
                        `Remove ${member.name} from this store?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Deactivate",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await api.deactivateUser(selectedStoreId, member.staffId);
                                loadTeam();
                              } catch (err: any) {
                                Alert.alert("Error", err.message);
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="person-remove" size={14} color="#e53e3e" />
                    <Text style={[s.actionBtnText, { color: "#e53e3e" }]}>Deactivate</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}

          {members.length === 0 && (
            <View style={s.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>
                No team members yet. Invite your first team member.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Invite Modal */}
      <InviteModal
        visible={showInvite}
        onClose={() => setShowInvite(false)}
        storeId={selectedStoreId}
        userRole={userRole}
        colors={colors}
        onSuccess={() => {
          setShowInvite(false);
          loadTeam();
        }}
      />

      {/* Role Change Modal */}
      {roleModal && (
        <RoleChangeModal
          visible={!!roleModal}
          member={roleModal}
          onClose={() => setRoleModal(null)}
          storeId={selectedStoreId}
          userRole={userRole}
          colors={colors}
          onSuccess={() => {
            setRoleModal(null);
            loadTeam();
          }}
        />
      )}
    </View>
  );
}

function InviteModal({
  visible, onClose, storeId, userRole, colors, onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  storeId: string;
  userRole: string;
  colors: ColorScheme;
  onSuccess: () => void;
}) {
  const s = makeStyles(colors);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("staff");
  const [phone, setPhone] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableRoles = ROLES.filter((r) => {
    if (userRole === "owner") return true;
    return r.key !== "owner" && r.key !== "manager";
  });

  const handleSubmit = async () => {
    if (!email.trim() || !name.trim()) {
      Alert.alert("Error", "Email and name are required");
      return;
    }
    setSubmitting(true);
    try {
      await api.inviteUser(storeId, {
        email: email.trim(),
        name: name.trim(),
        role,
        phone: phone.trim() || undefined,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      });
      Alert.alert("Success", `Invitation sent to ${email.trim()}. They will receive an email with a temporary password.`);
      setEmail(""); setName(""); setRole("staff"); setPhone(""); setHourlyRate("");
      onSuccess();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to invite user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={[s.modalContent, { backgroundColor: colors.card }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Invite Team Member</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Email *</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.borderLight }]}
              value={email}
              onChangeText={setEmail}
              placeholder="employee@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Full Name *</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.borderLight }]}
              value={name}
              onChangeText={setName}
              placeholder="John Smith"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Role *</Text>
            <View style={s.roleSelector}>
              {availableRoles.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[
                    s.roleOption,
                    { borderColor: role === r.key ? r.color : colors.borderLight },
                    role === r.key && { backgroundColor: r.color + "12" },
                  ]}
                  onPress={() => setRole(r.key)}
                >
                  <Text style={[s.roleOptionLabel, { color: role === r.key ? r.color : colors.text }]}>
                    {r.label}
                  </Text>
                  <Text style={[s.roleOptionDesc, { color: colors.textSecondary }]}>
                    {r.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Phone (optional)</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.borderLight }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Hourly Rate (optional)</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.borderLight }]}
              value={hourlyRate}
              onChangeText={setHourlyRate}
              placeholder="15.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.submitBtnText}>Send Invitation</Text>
              )}
            </TouchableOpacity>

            <Text style={[s.inviteNote, { color: colors.textMuted }]}>
              An email with a temporary password will be sent. The user must change their password on first login.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RoleChangeModal({
  visible, member, onClose, storeId, userRole, colors, onSuccess,
}: {
  visible: boolean;
  member: TeamMember;
  onClose: () => void;
  storeId: string;
  userRole: string;
  colors: ColorScheme;
  onSuccess: () => void;
}) {
  const s = makeStyles(colors);
  const [selectedRole, setSelectedRole] = useState(member.role);
  const [submitting, setSubmitting] = useState(false);

  const availableRoles = ROLES.filter((r) => {
    if (userRole === "owner") return true;
    return r.key !== "owner" && r.key !== "manager";
  });

  const handleSave = async () => {
    if (selectedRole === member.role) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await api.updateRole(storeId, member.staffId, selectedRole);
      Alert.alert("Success", `${member.name}'s role updated to ${selectedRole}`);
      onSuccess();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update role");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={[s.modalContent, { backgroundColor: colors.card, maxHeight: "60%" }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Change Role</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[s.roleChangeInfo, { color: colors.textSecondary }]}>
            Changing role for {member.name} ({member.email})
          </Text>

          <View style={s.roleSelector}>
            {availableRoles.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[
                  s.roleOption,
                  { borderColor: selectedRole === r.key ? r.color : colors.borderLight },
                  selectedRole === r.key && { backgroundColor: r.color + "12" },
                ]}
                onPress={() => setSelectedRole(r.key)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[s.roleOptionLabel, { color: selectedRole === r.key ? r.color : colors.text }]}>
                    {r.label}
                  </Text>
                  {r.key === member.role && (
                    <Text style={[s.currentBadge, { color: colors.textMuted }]}>current</Text>
                  )}
                </View>
                <Text style={[s.roleOptionDesc, { color: colors.textSecondary }]}>
                  {r.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
            onPress={handleSave}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitBtnText}>
                {selectedRole === member.role ? "No Change" : "Update Role"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    title: { fontSize: fontSize.lg, fontWeight: "700" },
    subtitle: { fontSize: fontSize.xs, marginTop: 2 },
    inviteBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    inviteBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.sm },
    memberCard: {
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
    },
    memberTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: fontSize.md, fontWeight: "700" },
    memberName: { fontSize: fontSize.md, fontWeight: "600" },
    memberEmail: { fontSize: fontSize.xs },
    roleBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    roleBadgeText: { fontSize: fontSize.xs, fontWeight: "700", textTransform: "capitalize" },
    memberDetails: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.xs,
      marginLeft: 54,
    },
    detailText: { fontSize: fontSize.xs },
    memberActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginLeft: 54,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
    },
    actionBtnText: { fontSize: fontSize.xs, fontWeight: "600" },
    emptyState: { alignItems: "center", paddingTop: spacing.xxl },
    emptyText: { fontSize: fontSize.sm, marginTop: spacing.md, textAlign: "center" },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: spacing.lg,
      maxHeight: "85%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    modalTitle: { fontSize: fontSize.lg, fontWeight: "700" },
    fieldLabel: { fontSize: fontSize.xs, fontWeight: "600", marginBottom: 4, marginTop: spacing.sm },
    input: {
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: Platform.OS === "ios" ? 14 : 10,
      fontSize: fontSize.sm,
    },
    roleSelector: { gap: spacing.xs, marginTop: 4 },
    roleOption: {
      borderWidth: 1.5,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
    },
    roleOptionLabel: { fontSize: fontSize.sm, fontWeight: "700" },
    roleOptionDesc: { fontSize: fontSize.xs, marginTop: 2 },
    currentBadge: { fontSize: 10, fontStyle: "italic" },
    roleChangeInfo: { fontSize: fontSize.sm, marginBottom: spacing.md },
    submitBtn: {
      padding: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: "center",
      marginTop: spacing.lg,
    },
    submitBtnText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
    inviteNote: { fontSize: fontSize.xs, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.md },
  });
