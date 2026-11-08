import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database.js';
import '../src/modules/auth/User.model.js';
import '../src/modules/brands/Brand.model.js';
import '../src/modules/posts/ContentPost.model.js';
import '../src/modules/integrations/SocialAccount.model.js';
await connectDatabase();
try {
  for (const model of Object.values(mongoose.models)) {
    await model.createIndexes();
    console.info(`Indexes ready: ${model.modelName}`);
  }
} finally {
  await mongoose.disconnect();
}
