import { DataTypes } from "sequelize";

/**
 * @param {import('sequelize').Sequelize} sequelize
 */
export function initModels(sequelize) {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      email: { type: DataTypes.TEXT, allowNull: false, unique: true },
      password_hash: { type: DataTypes.TEXT, allowNull: false },
      twitter_connected: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      linkedin_connected: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      composio_entity_id: { type: DataTypes.TEXT, allowNull: true, unique: true },
    },
    { tableName: "users", underscored: true, timestamps: true },
  );

  const UserProfile = sequelize.define(
    "UserProfile",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      user_id: { type: DataTypes.UUID, allowNull: false, unique: true },
      profession: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      audience: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      vibe: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      dynamic_adjustments: { type: DataTypes.JSONB, allowNull: true },
    },
    { tableName: "user_profiles", underscored: true, timestamps: true },
  );

  const Post = sequelize.define(
    "Post",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      user_id: { type: DataTypes.UUID, allowNull: false },
      topic: { type: DataTypes.TEXT, allowNull: false },
      tone: { type: DataTypes.TEXT, allowNull: true },
      generated_text: { type: DataTypes.TEXT, allowNull: false },
      image_prompt: { type: DataTypes.TEXT, allowNull: true },
      image_url: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM("draft", "published", "rejected", "selected"),
        allowNull: false,
        defaultValue: "draft",
      },
      published_at: { type: DataTypes.DATE, allowNull: true },
      selected_variation_id: { type: DataTypes.INTEGER, allowNull: true },
      selected_text: { type: DataTypes.TEXT, allowNull: true },
      selected_image_base64: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "posts", underscored: true, timestamps: true },
  );

  const PostFeedback = sequelize.define(
    "PostFeedback",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      post_id: { type: DataTypes.UUID, allowNull: false },
      user_id: { type: DataTypes.UUID, allowNull: false },
      action: {
        type: DataTypes.ENUM("accepted", "rejected", "edited", "regenerated"),
        allowNull: false,
      },
      edited_text: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    { tableName: "post_feedback", underscored: true, timestamps: true, updatedAt: false },
  );

  const UserBehavior = sequelize.define(
    "UserBehavior",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      user_id: { type: DataTypes.UUID, allowNull: false },
      event_type: { type: DataTypes.TEXT, allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    { tableName: "user_behavior", underscored: true, timestamps: true, updatedAt: false },
  );

  const PostReworkLog = sequelize.define(
    "PostReworkLog",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      user_id: { type: DataTypes.UUID, allowNull: false },
      source_post_id: { type: DataTypes.UUID, allowNull: true },
      result_post_id: { type: DataTypes.UUID, allowNull: false },
      base_draft_text: { type: DataTypes.TEXT, allowNull: false },
      user_instructions: { type: DataTypes.TEXT, allowNull: false },
      source_variation_id: { type: DataTypes.INTEGER, allowNull: true },
      model_output: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    { tableName: "post_rework_logs", underscored: true, timestamps: true, createdAt: "created_at", updatedAt: false },
  );

  const SatisfactionSignal = sequelize.define(
    "SatisfactionSignal",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      post_id: { type: DataTypes.UUID, allowNull: false },
      user_id: { type: DataTypes.UUID, allowNull: false },
      signal: {
        type: DataTypes.STRING(16),
        allowNull: false,
      },
      variation_id: { type: DataTypes.INTEGER, allowNull: true },
      selected_text: { type: DataTypes.TEXT, allowNull: true },
      context: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    { tableName: "satisfaction_signals", underscored: true, timestamps: true, createdAt: "created_at", updatedAt: false },
  );

  User.hasOne(UserProfile, { foreignKey: "user_id", onDelete: "CASCADE" });
  UserProfile.belongsTo(User, { foreignKey: "user_id", onDelete: "CASCADE" });

  User.hasMany(Post, { foreignKey: "user_id", onDelete: "CASCADE" });
  Post.belongsTo(User, { foreignKey: "user_id", onDelete: "CASCADE" });

  Post.hasMany(PostFeedback, { foreignKey: "post_id", onDelete: "CASCADE" });
  PostFeedback.belongsTo(Post, { foreignKey: "post_id", onDelete: "CASCADE" });

  User.hasMany(PostFeedback, { foreignKey: "user_id", onDelete: "CASCADE" });
  PostFeedback.belongsTo(User, { foreignKey: "user_id", onDelete: "CASCADE" });

  User.hasMany(UserBehavior, { foreignKey: "user_id", onDelete: "CASCADE" });
  UserBehavior.belongsTo(User, { foreignKey: "user_id", onDelete: "CASCADE" });

  User.hasMany(PostReworkLog, { foreignKey: "user_id", onDelete: "CASCADE" });
  PostReworkLog.belongsTo(User, { foreignKey: "user_id", onDelete: "CASCADE" });

  Post.hasMany(PostReworkLog, { foreignKey: "source_post_id", as: "ReworkLogsFrom", onDelete: "SET NULL" });
  PostReworkLog.belongsTo(Post, { foreignKey: "source_post_id", as: "SourcePost", onDelete: "SET NULL" });

  Post.hasMany(PostReworkLog, { foreignKey: "result_post_id", as: "ReworkLogsAsResult", onDelete: "CASCADE" });
  PostReworkLog.belongsTo(Post, { foreignKey: "result_post_id", as: "ResultPost", onDelete: "CASCADE" });

  Post.hasMany(SatisfactionSignal, { foreignKey: "post_id", onDelete: "CASCADE" });
  SatisfactionSignal.belongsTo(Post, { foreignKey: "post_id", onDelete: "CASCADE" });
  User.hasMany(SatisfactionSignal, { foreignKey: "user_id", onDelete: "CASCADE" });
  SatisfactionSignal.belongsTo(User, { foreignKey: "user_id", onDelete: "CASCADE" });

  return { User, UserProfile, Post, PostFeedback, UserBehavior, PostReworkLog, SatisfactionSignal };
}
