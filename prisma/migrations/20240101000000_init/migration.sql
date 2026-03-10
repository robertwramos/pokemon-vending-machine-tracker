-- CreateTable
CREATE TABLE `VendingMachine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `machineId` VARCHAR(191) NOT NULL,
    `crossStreets` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `zip` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'unknown',
    `lastCheckedAt` DATETIME(3) NULL,
    `lastCheckedBy` VARCHAR(191) NULL,
    `restockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VendingMachine_machineId_key`(`machineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MachineMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendingMachineId` INTEGER NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MachineMessage_messageId_key`(`messageId`),
    INDEX `MachineMessage_channelId_idx`(`channelId`),
    UNIQUE INDEX `MachineMessage_vendingMachineId_channelId_key`(`vendingMachineId`, `channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MachineCheckIn` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendingMachineId` INTEGER NOT NULL,
    `checkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `checkedBy` VARCHAR(191) NOT NULL,
    `packAvailable` BOOLEAN NOT NULL DEFAULT false,
    `boosterBundleAvailable` BOOLEAN NOT NULL DEFAULT false,
    `etbAvailable` BOOLEAN NOT NULL DEFAULT false,
    `boosterBoxAvailable` BOOLEAN NOT NULL DEFAULT false,
    `tinAvailable` BOOLEAN NOT NULL DEFAULT false,
    `outOfStock` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MachineCheckIn_vendingMachineId_idx`(`vendingMachineId`),
    INDEX `MachineCheckIn_checkedAt_idx`(`checkedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MachineRestock` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendingMachineId` INTEGER NOT NULL,
    `restockedAt` DATETIME(3) NOT NULL,
    `reportedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MachineRestock_vendingMachineId_idx`(`vendingMachineId`),
    INDEX `MachineRestock_restockedAt_idx`(`restockedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MachineMessage` ADD CONSTRAINT `MachineMessage_vendingMachineId_fkey` FOREIGN KEY (`vendingMachineId`) REFERENCES `VendingMachine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineCheckIn` ADD CONSTRAINT `MachineCheckIn_vendingMachineId_fkey` FOREIGN KEY (`vendingMachineId`) REFERENCES `VendingMachine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineRestock` ADD CONSTRAINT `MachineRestock_vendingMachineId_fkey` FOREIGN KEY (`vendingMachineId`) REFERENCES `VendingMachine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

