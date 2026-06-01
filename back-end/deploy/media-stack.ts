import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as Lambda from 'aws-cdk-lib/aws-lambda';
import * as S3 from 'aws-cdk-lib/aws-s3';
import * as S3N from 'aws-cdk-lib/aws-s3-notifications';
import * as ACM from 'aws-cdk-lib/aws-certificatemanager';
import * as Route53 from 'aws-cdk-lib/aws-route53';
import * as Route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as CloudFront from 'aws-cdk-lib/aws-cloudfront';
import * as CloudFrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as IAM from 'aws-cdk-lib/aws-iam';

export interface MediaProps extends cdk.StackProps {
  mediaBucketName: string;
  mediaDomain: string;
  thumbnailerFunctionArn: string;
  thumbnailerRoleArn: string;
  htmlToPDFFunctionArn: string;
  htmlToPDFFunctionRoleArn: string;
  htmlToPDFViaS3BucketFunctionArn: string;
  htmlToPDFViaS3BucketFunctionRoleArn: string;
}

export class MediaStack extends cdk.Stack {
  public readonly mediaBucketArn: string;

  constructor(scope: Construct, id: string, props: MediaProps) {
    super(scope, id, props);

    const s3MediaBucket = new S3.Bucket(this, 'MediaBucket', {
      bucketName: props.mediaBucketName,
      publicReadAccess: false,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [S3.HttpMethods.GET, S3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          exposedHeaders: [],
          maxAge: 3000
        }
      ],
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [
        { prefix: 'downloads/', expiration: cdk.Duration.days(1) },
        {
          prefix: 'attachments/',
          transitions: [{ storageClass: S3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(200) }]
        },
        {
          prefix: 'images/',
          transitions: [{ storageClass: S3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(30) }]
        }
      ]
    });
    this.mediaBucketArn = s3MediaBucket.bucketArn;

    const thumbnailerFn = Lambda.Function.fromFunctionArn(this, 'SharedThumbnailerFn', props.thumbnailerFunctionArn);
    s3MediaBucket.addToResourcePolicy(
      new IAM.PolicyStatement({
        effect: IAM.Effect.ALLOW,
        principals: [new IAM.ArnPrincipal(props.thumbnailerRoleArn)],
        actions: ['s3:*'],
        resources: [
          `arn:aws:s3:::${s3MediaBucket.bucketName}/images/*`,
          `arn:aws:s3:::${s3MediaBucket.bucketName}/thumbnails/*`
        ]
      })
    );
    s3MediaBucket.addEventNotification(S3.EventType.OBJECT_CREATED, new S3N.LambdaDestination(thumbnailerFn), {
      prefix: 'images/'
    });

    Lambda.Function.fromFunctionArn(this, 'SharedHTMLToPDFFn', props.htmlToPDFFunctionArn);
    Lambda.Function.fromFunctionArn(this, 'SharedHTMLToPDFViaS3BucketFn', props.htmlToPDFViaS3BucketFunctionArn);
    s3MediaBucket.addToResourcePolicy(
      new IAM.PolicyStatement({
        effect: IAM.Effect.ALLOW,
        principals: [
          new IAM.ArnPrincipal(props.htmlToPDFFunctionRoleArn),
          new IAM.ArnPrincipal(props.htmlToPDFViaS3BucketFunctionRoleArn)
        ],
        actions: ['s3:*'],
        resources: [`arn:aws:s3:::${s3MediaBucket.bucketName}/downloads/*`]
      })
    );

    createCloudFrontDistributionForMediaBucket(this, s3MediaBucket, props.mediaDomain);
  }
}

const createCloudFrontDistributionForMediaBucket = (
  scope: Construct,
  mediaBucket: S3.Bucket,
  mediaDomain: string
): void => {
  const zone = Route53.HostedZone.fromLookup(scope, 'HostedZone', {
    domainName: mediaDomain.split('.').slice(-2).join('.')
  });

  const certificate = new ACM.DnsValidatedCertificate(scope, 'MediaCertificate', {
    domainName: mediaDomain,
    hostedZone: zone,
    region: 'us-east-1'
  });

  const mediaDistributionOAI = new CloudFront.OriginAccessIdentity(scope, 'DistributionOAI', {
    comment: `OAI for https://${mediaDomain}`
  });

  const mediaDistribution = new CloudFront.Distribution(scope, 'MediaDistribution', {
    defaultBehavior: {
      origin: new CloudFrontOrigins.S3Origin(mediaBucket, {
        originAccessIdentity: mediaDistributionOAI,
        originPath: '/thumbnails'
      }),
      compress: true,
      viewerProtocolPolicy: CloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
    },
    domainNames: [mediaDomain],
    priceClass: CloudFront.PriceClass.PRICE_CLASS_100,
    certificate: ACM.Certificate.fromCertificateArn(scope, 'CloudFrontMediaCertificate', certificate.certificateArn)
  });

  new Route53.ARecord(scope, 'MediaDomainRecord', {
    zone: zone,
    recordName: mediaDomain,
    target: Route53.RecordTarget.fromAlias(new Route53Targets.CloudFrontTarget(mediaDistribution))
  });
};
