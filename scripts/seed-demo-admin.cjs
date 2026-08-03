const path = require('node:path');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');

process.chdir(path.resolve(__dirname, '..'));
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

async function main() {
  const dataSourceModule = require('../apps/api/dist/infrastructure/database-data-source.js');
  const { Organization } = require('../apps/api/dist/modules/organizations/organization.entity.js');
  const { User } = require('../apps/api/dist/modules/users/user.entity.js');

  const dataSource = dataSourceModule.default ?? dataSourceModule;
  await dataSource.initialize();

  try {
    const organizationRepo = dataSource.getRepository(Organization);
    const userRepo = dataSource.getRepository(User);

    let organization =
      await organizationRepo.findOne({ where: { code: 'demo-vitalis' } }) ||
      await organizationRepo.findOne({ where: { name: 'Demo Vitalis' } });

    if (!organization) {
      organization = organizationRepo.create({
        id: randomUUID(),
        name: 'Demo Vitalis',
        code: 'demo-vitalis',
        currency: 'CLP',
        isActive: true,
      });
      organization = await organizationRepo.save(organization);
      console.log(`Created organization ${organization.id}`);
    } else {
      console.log(`Using organization ${organization.id}`);
    }

    const passwordHash = await bcrypt.hash('demo123456!', Number(process.env.BCRYPT_ROUNDS || 12));
    const now = new Date();

    let user = await userRepo.findOne({ where: { email: 'demo@lavitamina.cl' } });

    if (!user) {
      user = userRepo.create({
        id: randomUUID(),
        organizationId: organization.id,
        name: 'Demo Vitalis',
        email: 'demo@lavitamina.cl',
        password: passwordHash,
        role: 'admin',
        isActive: true,
        mustChangePassword: false,
        invitedAt: now,
        passwordChangedAt: now,
      });
      await userRepo.save(user);
      console.log(`Created user ${user.email}`);
    } else {
      user.organizationId = organization.id;
      user.name = 'Demo Vitalis';
      user.password = passwordHash;
      user.role = 'admin';
      user.isActive = true;
      user.mustChangePassword = false;
      user.invitedAt = user.invitedAt || now;
      user.passwordChangedAt = now;
      await userRepo.save(user);
      console.log(`Updated user ${user.email}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Failed to seed demo admin');
  console.error(error);
  process.exit(1);
});
