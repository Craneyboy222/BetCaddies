import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required'
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    throw new Error(`User with email ${email} already exists`)
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'admin',
    },
  })

  console.log(`✅ Admin user created: ${email}`)
}

main()
  .catch((err) => {
    console.error('❌ Error creating admin:', err.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
  