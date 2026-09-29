import { Controller, Get, Header, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Store Compliance & Legal')
@Controller()
export class ComplianceController {
  // ----------------------------------------------------
  // Android App Links
  // ----------------------------------------------------

  @Public()
  @Get('.well-known/assetlinks.json')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json')
  @ApiOperation({ summary: 'Android Digital Asset Links verification manifest' })
  getAssetLinks(): unknown {
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.nazar.app',
          sha256_cert_fingerprints: [
            '14:6D:E9:7D:0F:52:AB:E0:16:D4:F4:79:20:FB:0B:FD:E1:92:07:3E:68:57:3E:F8:78:E5:94:0A:78:B1:A7:F9',
            'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C',
          ],
        },
      },
    ];
  }

  // ----------------------------------------------------
  // iOS Universal Links
  // ----------------------------------------------------

  @Public()
  @Get('.well-known/apple-app-site-association')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json')
  @ApiOperation({ summary: 'Apple App Site Association verification manifest' })
  getAppleAppSiteAssociation(): unknown {
    return {
      applinks: {
        apps: [],
        details: [
          {
            appID: 'TEAMID1234.com.nazar.app',
            paths: [
              '/chat/*',
              '/matches/*',
              '/discovery',
              '/profile/*',
              '/events/*',
              '/communities/*',
              '/billing/*',
              '/notifications',
            ],
          },
        ],
      },
      webcredentials: {
        apps: ['TEAMID1234.com.nazar.app'],
      },
    };
  }

  // ----------------------------------------------------
  // Public Legal & Compliance Documents
  // ----------------------------------------------------

  @Public()
  @Get('v1/compliance/privacy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public Privacy Policy document' })
  getPrivacyPolicy(): unknown {
    return {
      document: 'Nazar Privacy Policy',
      version: '1.0.0',
      lastUpdated: '2026-09-29',
      effectiveDate: '2026-09-29',
      contact: 'privacy@nazar.app',
      dataCollection: {
        location:
          'Coarse and fine location while using the app for local discovery matching. Exact coordinates are protected and never revealed.',
        identity:
          'Phone number or verified email for authentication. Not shared with third parties.',
        photos: 'Profile pictures uploaded with explicit consent for profile display.',
        analytics:
          'Pseudonymized interaction telemetry to detect fraud and improve matching performance.',
      },
      retentionPolicy:
        'Data retained while account is active. Soft-deleted immediately on deletion request and permanently purged within 30 days.',
      deletionInstructions:
        'Users can delete their account directly inside the app under Profile -> Settings -> Delete Account, or by emailing privacy@nazar.app.',
    };
  }

  @Public()
  @Get('v1/compliance/terms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public Terms of Service document' })
  getTermsOfService(): unknown {
    return {
      document: 'Nazar Terms of Service',
      version: '1.0.0',
      lastUpdated: '2026-09-29',
      effectiveDate: '2026-09-29',
      contact: 'legal@nazar.app',
      ageRequirement: 'Users must be at least 18 years of age to register or use the platform.',
      communityRules:
        'Harassment, hate speech, explicit illegal media, impersonation, and fraudulent behavior result in immediate account suspension.',
      subscriptions:
        'Premium features billed through Apple App Store or Google Play Store according to respective store terms.',
    };
  }

  @Public()
  @Get('v1/compliance/guidelines')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public Community Guidelines' })
  getCommunityGuidelines(): unknown {
    return {
      document: 'Nazar Community Guidelines',
      version: '1.0.0',
      lastUpdated: '2026-09-29',
      principles: [
        'Be respectful and authentic.',
        'Zero tolerance for harassment, bullying, or hate speech.',
        'Consent and privacy are paramount: do not share private chats or media outside the platform.',
        'Report safety violations using in-app reporting tools.',
      ],
    };
  }

  @Public()
  @Get('v1/compliance/delete-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public Account Deletion Instructions (Google Play & Apple Requirement)',
  })
  getAccountDeletionInstructions(): unknown {
    return {
      title: 'How to Delete Your Nazar Account',
      webUrl: 'https://nazar.app/legal/delete-account',
      inAppInstructions: [
        'Open the Nazar mobile application on iOS or Android.',
        'Navigate to your Profile tab.',
        'Tap Settings -> Account -> Delete Account.',
        'Confirm the deletion dialog. Your sessions will be immediately terminated and profile hidden from all users.',
      ],
      supportRequestOption:
        'If you cannot access the app, email privacy@nazar.app from your registered email address with the subject "Account Deletion Request".',
    };
  }
}
