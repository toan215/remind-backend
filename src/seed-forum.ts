import mongoose from 'mongoose';
import Forum from './models/forum.model';
import ForumPost from './models/forumPost.model';
import ForumComment from './models/forumComment.model';
import * as fs from 'fs';
import * as path from 'path';

const seed = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/remind';
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');

    // Read the sample data file
    const rawData = fs.readFileSync(path.join(__dirname, '../forum-sample-data.json'), 'utf-8');
    const seedData = JSON.parse(rawData);

    // Xóa dữ liệu cũ (tùy chọn) để tránh trùng lặp
    console.log('Đang xóa dữ liệu cũ...');
    await Forum.deleteMany({});
    await ForumPost.deleteMany({});
    await ForumComment.deleteMany({});

    console.log('Đang chèn dữ liệu mới...');
    
    // Map data
    const forums = seedData.forums.map((f: any) => {
      f._id = new mongoose.Types.ObjectId(f._id.$oid);
      f.createdByAdminId = new mongoose.Types.ObjectId('60d5ecb8b311c81f00b21a99'); // Dummy admin
      f.category = f.category || 'General';
      f.createdAt = new Date(f.createdAt.$date);
      f.updatedAt = new Date(f.updatedAt.$date);
      return f;
    });

    const posts = seedData.forumPosts.map((p: any) => {
      p._id = new mongoose.Types.ObjectId(p._id.$oid);
      p.forumId = new mongoose.Types.ObjectId(p.forumId.$oid);
      p.authorId = new mongoose.Types.ObjectId(p.authorId.$oid);
      p.likedBy = p.likedBy.map((l: any) => new mongoose.Types.ObjectId(l.$oid));
      p.createdAt = new Date(p.createdAt.$date);
      p.updatedAt = new Date(p.updatedAt.$date);
      return p;
    });

    const comments = seedData.forumComments.map((c: any) => {
      c._id = new mongoose.Types.ObjectId(c._id.$oid);
      c.postId = new mongoose.Types.ObjectId(c.postId.$oid);
      c.authorId = new mongoose.Types.ObjectId(c.authorId.$oid);
      if (c.parentId) {
        c.parentId = new mongoose.Types.ObjectId(c.parentId.$oid);
      }
      c.createdAt = new Date(c.createdAt.$date);
      c.updatedAt = new Date(c.updatedAt.$date);
      return c;
    });

    await Forum.insertMany(forums);
    await ForumPost.insertMany(posts);
    await ForumComment.insertMany(comments);

    console.log('✅ Seed dữ liệu hoàn tất!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi seed dữ liệu:', error);
    process.exit(1);
  }
};

seed();
